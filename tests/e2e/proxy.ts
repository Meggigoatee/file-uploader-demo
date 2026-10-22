import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

// Test transport only: real upload to Worker, then control response delivery.
export async function startProxy(afterUpload: (response: Response) => Promise<'send' | 'drop'>) {
  const upstream = 'http://127.0.0.1:4173';
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const headers = new Headers();
      for (const [key,value] of Object.entries(request.headers)) if (value && !['host','connection','transfer-encoding','content-length'].includes(key)) headers.set(key,Array.isArray(value) ? value.join(',') : value);
      if (headers.has('origin')) headers.set('origin',upstream);
      const body = Buffer.concat(chunks);
      const result = await fetch(upstream + request.url,{method:request.method,headers,body:body.length ? body : undefined});
      const bytes = Buffer.from(await result.arrayBuffer());
      const delivery=request.url === '/api/uploads' ? await afterUpload(result) : 'send';
      if (response.destroyed) return;
      if (delivery === 'drop') {
        // A partial response prevents Chromium transparently retrying an empty TCP failure.
        response.writeHead(result.status, { 'content-type':'application/json', 'content-length':bytes.length });
        response.flushHeaders();
        response.write(bytes.subarray(0,1),()=>response.destroy());
        return;
      }
      response.statusCode = result.status;
      result.headers.forEach((value,key)=>{if (!['content-encoding','content-length','transfer-encoding','connection'].includes(key)) response.setHeader(key,value);});
      response.end(bytes);
    } catch (error) { response.destroy(error as Error); }
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {
    url: 'http://127.0.0.1:' + (server.address() as AddressInfo).port,
    close: () => new Promise<void>(resolve=>{server.closeAllConnections(); server.close(()=>resolve());}),
  };
}
