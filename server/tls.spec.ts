import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCertificates, isLocalName, LocalCa, parseHosts } from './tls.ts';

function tempDir() {
	return mkdtempSync(join(tmpdir(), 'cyber-tracker-tls-'));
}

function leafFor(pem: string) {
	const [leaf, ca] = (
		pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []
	).map((block) => new X509Certificate(block));
	return { leaf, ca };
}

describe('isLocalName', () => {
	it('accepts names that only resolve locally', () => {
		expect(isLocalName('obelix')).toBe(true);
		expect(isLocalName('nas.local')).toBe(true);
		expect(isLocalName('box.tail1234.ts.net')).toBe(true);
		expect(isLocalName('localhost')).toBe(true);
		expect(isLocalName('example.com')).toBe(false);
		expect(isLocalName('example.com', ['example.com'])).toBe(true);
		expect(isLocalName('bad name')).toBe(false);
	});
});

describe('parseHosts', () => {
	it('splits on commas and spaces and strips IPv6 brackets', () => {
		expect(parseHosts(' 192.168.1.20, [fd00::5] Obelix ')).toEqual([
			'192.168.1.20',
			'fd00::5',
			'obelix'
		]);
		expect(parseHosts(undefined)).toEqual([]);
	});
});

describe('createCertificates', () => {
	it('creates its own CA and signs a certificate per local name', async () => {
		const data = tempDir();

		const certs = await createCertificates({ TLS_HOSTS: '192.168.1.20' }, data);
		expect(certs.mode).toBe('own-ca');
		const ca = certs.source as LocalCa;
		await ca.contextFor('obelix');

		const { leaf, ca: chained } = leafFor(
			readFileSync(join(data, 'tls', 'hosts', 'obelix.pem'), 'utf8')
		);
		const root = new X509Certificate(readFileSync(join(data, 'tls', 'ca.crt')));
		expect(leaf.subjectAltName).toBe('DNS:obelix');
		expect(leaf.checkIssued(root)).toBe(true);
		expect(chained.fingerprint256).toBe(root.fingerprint256);

		const fallback = leafFor(readFileSync(join(data, 'tls', 'hosts', '_default.pem'), 'utf8')).leaf;
		expect(fallback.subjectAltName).toContain('IP Address:192.168.1.20');
	});

	it('replaces host certificates signed by another CA', async () => {
		const data = tempDir();
		const other = tempDir();
		const old = new LocalCa(other, join(data, 'tls', 'hosts'));
		await old.init({ create: true });
		await old.contextFor('obelix');

		const certs = await createCertificates({}, data);
		await (certs.source as LocalCa).contextFor('obelix');

		const root = new X509Certificate(readFileSync(join(data, 'tls', 'ca.crt')));
		const { leaf } = leafFor(readFileSync(join(data, 'tls', 'hosts', 'obelix.pem'), 'utf8'));
		expect(leaf.checkIssued(root)).toBe(true);
		const fallback = leafFor(readFileSync(join(data, 'tls', 'hosts', '_default.pem'), 'utf8')).leaf;
		expect(fallback.checkIssued(root)).toBe(true);
	});

	it('ignores TLS_CA_DIR and says so', async () => {
		const shared = tempDir();
		await new LocalCa(shared, join(shared, 'hosts')).init({ create: true });
		const data = tempDir();

		const certs = await createCertificates({ TLS_CA_DIR: shared }, data);

		expect(certs.mode).toBe('own-ca');
		expect(certs.note).toContain('TLS_CA_DIR is no longer used');
		expect((certs.source as LocalCa).certPath).toBe(join(data, 'tls', 'ca.crt'));
	});

	it('requires both custom certificate files', async () => {
		await expect(createCertificates({ TLS_CERT: '/x.pem' }, tempDir())).rejects.toThrow(
			'Set both TLS_CERT and TLS_KEY'
		);
	});
});
