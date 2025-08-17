import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import { enqueueJob } from "./worker";

interface EnqueueRequest {
  placeId: string;
  cursor?: string;
}

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendResponse(res: ServerResponse, statusCode: number, data: ApiResponse) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));

  // Log API call for observability
  console.log(JSON.stringify({
    level: "info",
    msg: "api_response",
    status: statusCode,
    success: data.success,
    timestamp: data.timestamp
  }));
}

async function handleEnqueueJob(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req);
    const payload: EnqueueRequest = JSON.parse(body);

    if (!payload.placeId) {
      sendResponse(res, 400, {
        success: false,
        error: "placeId is required",
        timestamp: new Date().toISOString()
      });
      return;
    }

    const job = await enqueueJob(payload.placeId, payload.cursor);
    
    sendResponse(res, 200, {
      success: true,
      data: {
        jobId: job.id,
        placeId: payload.placeId,
        cursor: payload.cursor ?? "start",
        enqueueTime: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      msg: "api_enqueue_error",
      error: String(error),
      timestamp: new Date().toISOString()
    }));

    sendResponse(res, 500, {
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString()
    });
  }
}

function handleHealth(req: IncomingMessage, res: ServerResponse) {
  sendResponse(res, 200, {
    success: true,
    data: {
      status: "healthy",
      service: "argus-worker-node",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: {
        nodeVersion: process.version,
        queueUrl: process.env.QUEUE_URL ?? "redis://127.0.0.1:6379",
        workerConcurrency: process.env.WORKER_CONCURRENCY ?? 3
      }
    },
    timestamp: new Date().toISOString()
  });
}

function handleOptions(req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 204;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end();
}

export function startApiServer(port: number = 3000) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const method = req.method?.toUpperCase();

    console.log(JSON.stringify({
      level: "debug",
      msg: "api_request",
      method,
      path: url.pathname,
      timestamp: new Date().toISOString()
    }));

    if (method === 'OPTIONS') {
      handleOptions(req, res);
      return;
    }

    switch (url.pathname) {
      case '/enqueue':
        if (method === 'POST') {
          await handleEnqueueJob(req, res);
        } else {
          sendResponse(res, 405, {
            success: false,
            error: "Method not allowed",
            timestamp: new Date().toISOString()
          });
        }
        break;

      case '/health':
        if (method === 'GET') {
          handleHealth(req, res);
        } else {
          sendResponse(res, 405, {
            success: false,
            error: "Method not allowed",
            timestamp: new Date().toISOString()
          });
        }
        break;

      default:
        sendResponse(res, 404, {
          success: false,
          error: "Not found",
          timestamp: new Date().toISOString()
        });
    }
  });

  server.listen(port, () => {
    console.log(JSON.stringify({
      level: "info",
      msg: "api_server_started",
      port,
      endpoints: ["/enqueue", "/health"],
      timestamp: new Date().toISOString()
    }));
  });

  return server;
}

// Start API server if this file is run directly
if (require.main === module) {
  const port = Number(process.env.API_PORT) || 3000;
  startApiServer(port);
}
