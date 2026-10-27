import {
	createServer as createHttpServer,
	type IncomingMessage,
	type Server as HttpServer,
	type ServerResponse
} from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createNetServer, type Server } from 'node:net';
import { resolve } from 'node:path';
import { createCertificates } from './tls.ts';

type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

const protocolHeader = (process.env.PROTOCOL_HEADER ||= 'x-forwarded-proto');
const useHttps = !['off', 'false', '0', 'no'].includes((process.env.HTTPS ?? 'on').toLowerCase());
const certificates = useHttps
	? await createCertificates(process.env, resolve(process.env.DATA_DIR || 'data'))
	: null;

const handlerUrl = new URL('../build/handler.js', import.meta.url).href;
const { handler } = (await import(handlerUrl)) as { handler: Handler };

function serve(req: IncomingMessage, res: ServerResponse, protocol: 'http' | 'https') {
	if (protocol === 'https' || !req.headers[protocolHeader]) req.headers[protocolHeader] = protocol;
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
}

function servePlain(req: IncomingMessage, res: ServerResponse) {
	const path = (req.url ?? '/').split('?')[0];
	if (!certificates || req.headers[protocolHeader] || path === '/api/status') {
		return serve(req, res, 'http');
	}
	if (!req.headers.host) {
		res.statusCode = 400;
		return res.end('Missing Host header');
	}
	res.statusCode = 308;
	res.setHeader('location', `https://${req.headers.host}${req.url ?? '/'}`);
	res.end();
}

const plain = createHttpServer(servePlain);
const servers: HttpServer[] = [plain];
let listener: Server = plain;

if (certificates) {
	const { source } = certificates;
	const secure = createHttpsServer(
		{
			SNICallback: (servername, done) =>
				source.contextFor(servername).then(
					(context) => done(null, context),
					(error: Error) => done(error)
				),
			...source.defaultPem()
		},
		(req, res) => serve(req, res, 'https')
	);
	secure.on('tlsClientError', () => {});
	setInterval(
		async () => {
			await source.defaultContext();
			secure.setSecureContext(source.defaultPem());
		},
		60 * 60 * 1000
	).unref();
	servers.push(secure);
	listener = createNetServer((socket) => {
		socket.once('error', () => socket.destroy());
		socket.once('data', (chunk) => {
			socket.pause();
			socket.unshift(chunk);
			(chunk[0] === 0x16 ? secure : plain).emit('connection', socket);
			process.nextTick(() => socket.resume());
		});
	});
}

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

listener.listen(port, host, () => {
	console.log(
		`Listening on ${certificates ? 'https' : 'http'}://${host === '0.0.0.0' ? 'localhost' : host}:${port}`
	);
	if (certificates) console.log(certificates.note);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.once(signal, () => {
		listener.close(() => process.exit(0));
		for (const server of servers) server.closeIdleConnections();
		setTimeout(() => process.exit(0), 10_000).unref();
	});
}
