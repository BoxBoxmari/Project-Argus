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
  "time"
)

type J map[string]any

func jlog(level, msg string, extra J) {
  rec := J{"ts": time.Now().UTC().Format(time.RFC3339), "level": level, "module": "orchestrator-go", "msg": msg}
  for k,v := range extra { rec[k] = v }
  b, _ := json.Marshal(rec)
  fmt.Println(string(b))
}

func runNode(runID, jobID, url, out string) {
  env := os.Environ()
  env = append(env, "ARGUS_RUN_ID="+runID, "ARGUS_JOB_ID="+jobID, "ARGUS_LOG_LEVEL="+get("ARGUS_LOG_LEVEL","INFO"))
  env = append(env, "ARGUS_LOG_FILE="+filepath.Join("logs", "worker-"+runID+".log"))

  cmd := exec.Command("node", "worker-node/puppeteer_engine/scraper.js", url, out)
  cmd.Env = env
  stdout, _ := cmd.StdoutPipe()
  stderr, _ := cmd.StderrPipe()
  _ = cmd.Start()

  go func() {
    s := bufio.NewScanner(stdout)
    for s.Scan() {
      line := s.Text()
      if strings.HasPrefix(line, "{") { fmt.Println(line) } else { jlog("INFO","node_stdout", J{"job_id":jobID, "line": line}) }
    }
  }()
  go func() {
    s := bufio.NewScanner(stderr)
    for s.Scan() {
      jlog("WARN","node_stderr", J{"job_id":jobID, "line": s.Text()})
    }
  }()

  _ = cmd.Wait()
  jlog("INFO","node_exit", J{"job_id":jobID, "code": cmd.ProcessState.ExitCode()})
}

func get(k, def string) string { if v := os.Getenv(k); v != "" { return v }; return def }

func main() {
  runID := time.Now().Format("20060102T150405")
  jlog("INFO", "start", J{"run_id": runID})
  // đọc urls.txt đơn giản
  data, _ := os.ReadFile("data/urls.txt")
  lines := []string{}
  for _, ln := range strings.Split(string(data), "\n") {
    ln = strings.TrimSpace(ln)
    if ln != "" { lines = append(lines, ln) }
  }
  os.MkdirAll("outputs", 0755)
  for i, u := range lines {
    jobID := fmt.Sprintf("%08x", rand.Uint32())
    out := fmt.Sprintf("outputs/orch_payload_%s_%02d.json", runID, i+1)
    jlog("INFO","dispatch", J{"run_id":runID, "job_id":jobID, "url":u, "out":out})
    runNode(runID, jobID, u, out)
    // jitter
    time.Sleep(time.Duration(1500+rand.Intn(2000)) * time.Millisecond)
  }
  jlog("INFO", "done", J{"run_id": runID})
}