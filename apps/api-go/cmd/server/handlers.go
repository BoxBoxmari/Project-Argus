package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"
)

type EnqReq struct {
	PlaceID string `json:"placeId"`
}

type EnqResp struct {
	Status    string `json:"status"`
	PlaceID   string `json:"placeId"`
	JobID     string `json:"jobId,omitempty"`
	Error     string `json:"error,omitempty"`
	Timestamp string `json:"timestamp"`
}

func enqueueHandler(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()

	// Set JSON content type
	w.Header().Set("Content-Type", "application/json")

	// Method validation
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		response := EnqResp{
			Status:    "error",
			Error:     "Method not allowed",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		json.NewEncoder(w).Encode(response)
		return
	}

	// Parse request body
	var req EnqReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		response := EnqResp{
			Status:    "error",
			Error:     "Invalid JSON payload",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		json.NewEncoder(w).Encode(response)
		log.Printf("invalid JSON: %v", err)
		return
	}

	// Validate place ID
	placeID := strings.TrimSpace(req.PlaceID)
	if placeID == "" {
		w.WriteHeader(http.StatusBadRequest)
		response := EnqResp{
			Status:    "error",
			Error:     "placeId is required",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		json.NewEncoder(w).Encode(response)
		return
	}

	// Enqueue to worker node
	workerResp, err := EnqueueToWorker(placeID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		response := EnqResp{
			Status:    "error",
			PlaceID:   placeID,
			Error:     "Failed to enqueue job: " + err.Error(),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		}
		json.NewEncoder(w).Encode(response)
		log.Printf("enqueue failed: placeId=%s, error=%v", placeID, err)
		return
	}

	// Success response
	w.WriteHeader(http.StatusAccepted)
	response := EnqResp{
		Status:    "enqueued",
		PlaceID:   placeID,
		JobID:     workerResp.JobID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	json.NewEncoder(w).Encode(response)

	// Log successful enqueue
	duration := time.Since(startTime)
	log.Printf("job enqueued successfully: placeId=%s, jobId=%s, duration=%v",
		placeID, workerResp.JobID, duration)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	health := map[string]interface{}{
		"status":     "healthy",
		"service":    "argus-orchestrator",
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
		"uptime":     time.Since(startTime).String(),
		"worker_url": getWorkerURL(),
	}

	json.NewEncoder(w).Encode(health)
}

var startTime = time.Now() // Track service start time
