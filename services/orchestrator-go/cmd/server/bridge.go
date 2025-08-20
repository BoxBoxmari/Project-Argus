package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

// WorkerJobRequest represents the structure for worker node job requests
type WorkerJobRequest struct {
	PlaceID string `json:"placeId"`
	Cursor  string `json:"cursor,omitempty"`
}

// WorkerJobResponse represents the response from worker node enqueue
type WorkerJobResponse struct {
	Success bool   `json:"success"`
	JobID   string `json:"jobId,omitempty"`
	Error   string `json:"error,omitempty"`
}

// EnqueueToWorker sends a job request to the worker node queue system
func EnqueueToWorker(placeID string) (*WorkerJobResponse, error) {
	workerURL := getWorkerURL()

	jobReq := WorkerJobRequest{
		PlaceID: placeID,
		Cursor:  "start", // Default cursor for new jobs
	}

	reqBody, err := json.Marshal(jobReq)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Post(workerURL+"/enqueue", "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("post to worker: %w", err)
	}
	defer resp.Body.Close()

	var workerResp WorkerJobResponse
	if err := json.NewDecoder(resp.Body).Decode(&workerResp); err != nil {
		return nil, fmt.Errorf("decode worker response: %w", err)
	}

	// The worker node responds with 202 Accepted when a job is queued
	if resp.StatusCode != http.StatusAccepted {
		return &workerResp, fmt.Errorf("worker returned status %d: %s", resp.StatusCode, workerResp.Error)
	}

	log.Printf("job enqueued: placeId=%s, jobId=%s", placeID, workerResp.JobID)
	return &workerResp, nil
}

// getWorkerURL returns the worker node service URL from environment or default
func getWorkerURL() string {
	if url := os.Getenv("WORKER_NODE_URL"); url != "" {
		return url
	}
	return "http://localhost:3000" // Default worker node URL
}

// GenerateJobID creates a deterministic job ID from place ID
func GenerateJobID(placeID string) string {
	return fmt.Sprintf("reviews:%s:start", placeID)
}
