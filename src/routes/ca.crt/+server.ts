import { readFile } from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const path = process.env.TLS_CA_CERT;
	const pem = path ? await readFile(path, 'utf8').catch(() => null) : null;
	if (!pem) error(404, 'This server doesn’t use its own certificate authority');
	return new Response(pem, {
		headers: {
			'content-type': 'application/x-x509-ca-cert',
			'content-disposition': 'attachment; filename="cyber-tracker-ca.crt"',
			'cache-control': 'no-store'
		}
	});
};
