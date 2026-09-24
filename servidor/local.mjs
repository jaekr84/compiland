// Corre el servidor de la clase en tu computadora (http://localhost:8787).
// Usa la misma base de datos que el de Neon: lee DATABASE_URL del archivo .env.
import http from 'node:http';
import handler from './index.mjs';

const PUERTO = Number(process.env.PORT) || 8787;

http.createServer(async (req, res) => {
  const partes = [];
  for await (const p of req) partes.push(p);
  const cuerpo = Buffer.concat(partes);
  const request = new Request('http://localhost:' + PUERTO + req.url, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : cuerpo,
  });
  const r = await handler.fetch(request);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PUERTO, () => {
  console.log('Servidor de la clase en http://localhost:' + PUERTO);
});
