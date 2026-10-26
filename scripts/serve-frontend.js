const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "frontend");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Invalid URL");
    return;
  }

  const filename = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (filename !== root && !filename.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(filename, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filename)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filename).pipe(response);
  });
}).listen(8080, "127.0.0.1", () => {
  console.log("The Praise Board is available at http://localhost:8080");
});
