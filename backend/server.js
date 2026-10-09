const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const projectDirectory = path.resolve(__dirname, "..");
const databasePath = path.join(__dirname, "complaints.json");
const maxRequestBytes = 16 * 1024;
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/script.js", ["script.js", "text/javascript; charset=utf-8"]]
]);

let complaints = [];
let mutationQueue = Promise.resolve();

class RequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(data));
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (
    origin &&
    (origin === "null" || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
  ) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

async function readJsonBody(request) {
  if (!request.headers["content-type"]?.includes("application/json")) {
    throw new RequestError(415, "Content-Type must be application/json.");
  }

  const chunks = [];
  let bytesRead = 0;

  for await (const chunk of request) {
    bytesRead += chunk.length;
    if (bytesRead > maxRequestBytes) {
      throw new RequestError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "Request body must contain valid JSON.");
  }
}

function validateComplaint(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError(400, "Provide a complaint with a title, location, and description.");
  }

  const { title, location, description } = body;
  if (
    typeof title !== "string" ||
    typeof location !== "string" ||
    typeof description !== "string"
  ) {
    throw new RequestError(400, "Title, location, and description must be text.");
  }

  const complaint = {
    title: title.trim(),
    location: location.trim(),
    description: description.trim()
  };

  if (!complaint.title || !complaint.location || !complaint.description) {
    throw new RequestError(400, "Title, location, and description are required.");
  }
  if (complaint.title.length > 120 || complaint.location.length > 160 || complaint.description.length > 2000) {
    throw new RequestError(400, "A complaint field is longer than the allowed limit.");
  }

  return complaint;
}

async function saveDatabase() {
  const temporaryPath = `${databasePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(complaints, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, databasePath);
}

function addComplaint(fields) {
  const operation = mutationQueue.then(async () => {
    const complaint = {
      id: randomUUID(),
      ...fields,
      status: "Pending",
      createdAt: new Date().toISOString()
    };

    complaints.unshift(complaint);
    try {
      await saveDatabase();
      return complaint;
    } catch (error) {
      complaints = complaints.filter((item) => item.id !== complaint.id);
      throw error;
    }
  });

  mutationQueue = operation.catch(() => {});
  return operation;
}

async function serveStaticFile(request, response, pathname) {
  const file = staticFiles.get(pathname);
  if (!file) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  const [filename, contentType] = file;
  const contents = await fs.readFile(path.join(projectDirectory, filename));
  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache"
  });
  response.end(request.method === "HEAD" ? undefined : contents);
}

async function handleRequest(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;

  if (pathname === "/api/complaints") {
    setCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "GET") {
      sendJson(response, 200, { complaints });
      return;
    }

    if (request.method === "POST") {
      const fields = validateComplaint(await readJsonBody(request));
      const complaint = await addComplaint(fields);
      sendJson(response, 201, { complaint });
      return;
    }

    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStaticFile(request, response, pathname);
    return;
  }

  response.setHeader("Allow", "GET, HEAD");
  sendJson(response, 405, { error: "Method not allowed." });
}

async function startServer() {
  await fs.mkdir(__dirname, { recursive: true });

  try {
    const storedData = await fs.readFile(databasePath, "utf8");
    complaints = JSON.parse(storedData);
    if (!Array.isArray(complaints)) {
      throw new Error("The complaints database must contain a JSON array.");
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    await saveDatabase();
  }

  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid port number between 1 and 65535.");
  }

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      if (error instanceof RequestError) {
        sendJson(response, error.statusCode, { error: error.message });
        return;
      }

      console.error("Request failed:", error);
      if (!response.headersSent) {
        sendJson(response, 500, { error: "Internal server error." });
      } else {
        response.destroy(error);
      }
    });
  });

  server.listen(port, () => {
    console.log(`CampusFix is running at http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Could not start CampusFix:", error);
  process.exitCode = 1;
});
