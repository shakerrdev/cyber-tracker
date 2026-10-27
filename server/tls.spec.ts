import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

	it('signs with an existing CA without writing into its folder', async () => {
		const shared = tempDir();
		await new LocalCa(shared, join(shared, 'hosts')).init({ create: true });
		const before = readdirSync(shared).sort();
		const data = tempDir();

		const certs = await createCertificates({ TLS_CA_DIR: shared }, data);
		await (certs.source as LocalCa).contextFor('obelix');

		expect(certs.mode).toBe('shared-ca');
		expect(readdirSync(shared).sort()).toEqual(before);
		const { leaf } = leafFor(readFileSync(join(data, 'tls', 'hosts', 'obelix.pem'), 'utf8'));
		expect(leaf.checkIssued(new X509Certificate(readFileSync(join(shared, 'ca.crt'))))).toBe(true);
	});

	it('falls back to its own CA when the shared folder has none', async () => {
		const data = tempDir();

		const certs = await createCertificates({ TLS_CA_DIR: tempDir() }, data);

		expect(certs.mode).toBe('own-ca');
		expect(certs.note).toContain('has no ca.crt and ca.key');
	});

	it('re-issues host certificates when the CA changes', async () => {
		const data = tempDir();
		const own = await createCertificates({}, data);
		await (own.source as LocalCa).contextFor('obelix');
		const shared = tempDir();
		await new LocalCa(shared, join(shared, 'hosts')).init({ create: true });

		const switched = await createCertificates({ TLS_CA_DIR: shared }, data);
		await (switched.source as LocalCa).contextFor('obelix');

		const { leaf } = leafFor(readFileSync(join(data, 'tls', 'hosts', 'obelix.pem'), 'utf8'));
		expect(leaf.checkIssued(new X509Certificate(readFileSync(join(shared, 'ca.crt'))))).toBe(true);
	});

	it('falls back to its own CA when the shared key is unusable', async () => {
		const shared = tempDir();
		await new LocalCa(shared, join(shared, 'hosts')).init({ create: true });
		writeFileSync(join(shared, 'ca.key'), 'not a key');

		const certs = await createCertificates({ TLS_CA_DIR: shared }, tempDir());

		expect(certs.mode).toBe('own-ca');
		expect(certs.note).toContain(`Can't use the CA in TLS_CA_DIR ${shared}`);
	});

	it('requires both custom certificate files', async () => {
		await expect(createCertificates({ TLS_CERT: '/x.pem' }, tempDir())).rejects.toThrow(
			'Set both TLS_CERT and TLS_KEY'
		);
	});
});
