package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type J map[string]any

type JobStats struct {
	TotalJobs          int       `json:"total_jobs"`
	CompletedJobs      int       `json:"completed_jobs"`
	FailedJobs         int       `json:"failed_jobs"`
	StartTime          time.Time `json:"start_time"`
	LastJobTime        time.Time `json:"last_job_time"`
	MaxConcurrency     int       `json:"max_concurrency"`
	CurrentConcurrency int       `json:"current_concurrency"`
	RSSLimitMB         int       `json:"rss_limit_mb"`
	MaxReviews         int       `json:"max_reviews"`
	mu                 sync.RWMutex
}

var (
	stats = &JobStats{
		StartTime:      time.Now(),
		MaxConcurrency: getEnvAsInt("ARGUS_MAX_CONC", 4),
		RSSLimitMB:     getEnvAsInt("ARGUS_RSS_MB", 2200),
		MaxReviews:     getEnvAsInt("ARGUS_MAX_REVIEWS", 0),
	}
)

func jlog(level, msg string, extra J) {
	rec := J{"ts": time.Now().UTC().Format(time.RFC3339), "level": level, "module": "orchestrator-go", "msg": msg}
	for k, v := range extra {
		rec[k] = v
	}
	b, _ := json.Marshal(rec)
	fmt.Println(string(b))
}

func getEnvAsInt(key string, defaultValue int) int {
	if val := os.Getenv(key); val != "" {
		if intVal, err := fmt.Sscanf(val, "%d", &defaultValue); err == nil && intVal == 1 {
			return defaultValue
		}
	}
	return defaultValue
}

func checkSystemHealth() error {
	// Check RSS memory usage
	if stats.RSSLimitMB > 0 {
		// This is a simplified check - in production you'd want to use proper system monitoring
		// For now, we'll just log the limit
		jlog("INFO", "health_check", J{
			"rss_limit_mb":    stats.RSSLimitMB,
			"max_concurrency": stats.MaxConcurrency,
			"max_reviews":     stats.MaxReviews,
		})
	}
	return nil
}

func runNode(runID, jobID, url, out string) error {
	env := os.Environ()
	env = append(env, "ARGUS_RUN_ID="+runID, "ARGUS_JOB_ID="+jobID, "ARGUS_LOG_LEVEL="+get("ARGUS_LOG_LEVEL", "INFO"))
	env = append(env, "ARGUS_LOG_FILE="+filepath.Join("logs", "worker-"+runID+".log"))

	// Allow override of node script path via ENV (useful for custom deployments)
	script := os.Getenv("ARGUS_NODE_SCRIPT")
	if script == "" {
		script = "node/puppeteer_engine/scraper.js"
	}

	cmd := exec.Command("node", script, url, out)
	cmd.Env = env
	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start node process: %w", err)
	}

	// Update concurrency stats
	stats.mu.Lock()
	stats.CurrentConcurrency++
	stats.mu.Unlock()

	defer func() {
		stats.mu.Lock()
		stats.CurrentConcurrency--
		stats.mu.Unlock()
	}()

	go func() {
		s := bufio.NewScanner(stdout)
		for s.Scan() {
			line := s.Text()
			if strings.HasPrefix(line, "{") {
				fmt.Println(line)
			} else {
				jlog("INFO", "node_stdout", J{"job_id": jobID, "line": line})
			}
		}
	}()

	go func() {
		s := bufio.NewScanner(stderr)
		for s.Scan() {
			jlog("WARN", "node_stderr", J{"job_id": jobID, "line": s.Text()})
		}
	}()

	if err := cmd.Wait(); err != nil {
		stats.mu.Lock()
		stats.FailedJobs++
		stats.mu.Unlock()
		jlog("ERROR", "node_exit", J{"job_id": jobID, "code": cmd.ProcessState.ExitCode(), "error": err.Error()})
		return fmt.Errorf("node process failed: %w", err)
	}

	stats.mu.Lock()
	stats.CompletedJobs++
	stats.LastJobTime = time.Now()
	stats.mu.Unlock()

	jlog("INFO", "node_exit", J{"job_id": jobID, "code": cmd.ProcessState.ExitCode()})
	return nil
}

func get(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	runID := time.Now().Format("20060102T150405")
	jlog("INFO", "start", J{
		"run_id": runID,
		"config": J{
			"max_concurrency": stats.MaxConcurrency,
			"rss_limit_mb":    stats.RSSLimitMB,
			"max_reviews":     stats.MaxReviews,
		},
	})

	// Health check at startup
	if err := checkSystemHealth(); err != nil {
		jlog("ERROR", "health_check_failed", J{"error": err.Error()})
		os.Exit(1)
	}

	// Read URLs from file
	data, err := os.ReadFile("data/urls.txt")
	if err != nil {
		jlog("ERROR", "failed_to_read_urls", J{"error": err.Error()})
		os.Exit(1)
	}

	lines := []string{}
	for _, ln := range strings.Split(string(data), "\n") {
		ln = strings.TrimSpace(ln)
		if ln != "" {
			lines = append(lines, ln)
		}
	}

	stats.TotalJobs = len(lines)
	jlog("INFO", "urls_loaded", J{"count": len(lines)})

	os.MkdirAll("outputs", 0755)

	// Process URLs with concurrency control
	semaphore := make(chan struct{}, stats.MaxConcurrency)
	var wg sync.WaitGroup

	for i, u := range lines {
		// Check if we've exceeded max reviews
		if stats.MaxReviews > 0 && stats.CompletedJobs >= stats.MaxReviews {
			jlog("INFO", "max_reviews_reached", J{
				"max_reviews": stats.MaxReviews,
				"completed":   stats.CompletedJobs,
			})
			break
		}

		wg.Add(1)
		go func(index int, url string) {
			defer wg.Done()

			// Acquire semaphore
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			jobID := fmt.Sprintf("%08x", rand.Uint32())
			out := fmt.Sprintf("outputs/orch_payload_%s_%02d.json", runID, index+1)

			jlog("INFO", "dispatch", J{
				"run_id":              runID,
				"job_id":              jobID,
				"url":                 url,
				"out":                 out,
				"current_concurrency": stats.CurrentConcurrency,
			})

			if err := runNode(runID, jobID, url, out); err != nil {
				jlog("ERROR", "job_failed", J{
					"job_id": jobID,
					"url":    url,
					"error":  err.Error(),
				})
			}

			// Jitter between jobs
			time.Sleep(time.Duration(1500+rand.Intn(2000)) * time.Millisecond)
		}(i, u)
	}

	// Wait for all jobs to complete
	wg.Wait()

	// Final stats
	stats.mu.RLock()
	finalStats := J{
		"run_id":          runID,
		"total_jobs":      stats.TotalJobs,
		"completed_jobs":  stats.CompletedJobs,
		"failed_jobs":     stats.FailedJobs,
		"success_rate":    float64(stats.CompletedJobs) / float64(stats.TotalJobs),
		"duration":        time.Since(stats.StartTime).String(),
		"max_concurrency": stats.MaxConcurrency,
		"rss_limit_mb":    stats.RSSLimitMB,
		"max_reviews":     stats.MaxReviews,
	}
	stats.mu.RUnlock()

	jlog("INFO", "done", finalStats)
}
