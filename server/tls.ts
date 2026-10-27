import 'reflect-metadata';
import { randomBytes, X509Certificate } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { join } from 'node:path';
import { createSecureContext, type SecureContext } from 'node:tls';
import * as x509 from '@peculiar/x509';

const subtle = globalThis.crypto.subtle;
const algorithm: EcKeyGenParams & EcdsaParams = {
	name: 'ECDSA',
	namedCurve: 'P-256',
	hash: 'SHA-256'
};
const day = 24 * 60 * 60 * 1000;
const localSuffixes = [
	'.local',
	'.lan',
	'.home',
	'.home.arpa',
	'.internal',
	'.localdomain',
	'.ts.net'
];

function writeAtomic(path: string, data: string, mode = 0o644) {
	const tmp = `${path}.${process.pid}.tmp`;
	writeFileSync(tmp, data, { mode });
	renameSync(tmp, path);
}

function serial() {
	const bytes = randomBytes(16);
	bytes[0] &= 0x7f;
	return bytes.toString('hex');
}

async function exportKey(key: CryptoKey) {
	return x509.PemConverter.encode(await subtle.exportKey('pkcs8', key), 'PRIVATE KEY');
}

async function importKey(pem: string) {
	const der = x509.PemConverter.decode(pem)[0];
	return subtle.importKey('pkcs8', der, algorithm, true, ['sign']);
}

export function parseHosts(value: string | undefined): string[] {
	return (value ?? '')
		.split(/[\s,]+/)
		.map((host) =>
			host
				.trim()
				.toLowerCase()
				.replace(/^\[|\]$/g, '')
		)
		.filter(Boolean);
}

export function isLocalName(name: string, extra: string[] = []): boolean {
	const host = name.toLowerCase().replace(/\.$/, '');
	if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return false;
	if (extra.includes(host) || host === 'localhost') return true;
	if (!host.includes('.')) return true;
	return localSuffixes.some((suffix) => host.endsWith(suffix));
}

export function hasCa(dir: string): boolean {
	return existsSync(join(dir, 'ca.crt')) && existsSync(join(dir, 'ca.key'));
}

export interface CertificateSource {
	contextFor(servername?: string): Promise<SecureContext>;
	defaultContext(): Promise<SecureContext>;
	defaultPem(): { key: string | Buffer; cert: string | Buffer };
}

export class LocalCa implements CertificateSource {
	readonly caDir: string;
	readonly hostsDir: string;
	readonly hosts: string[];
	private readonly contexts = new Map<string, SecureContext>();
	private readonly pending = new Map<string, Promise<SecureContext>>();
	private key!: CryptoKey;
	private cert!: x509.X509Certificate;
	private fallback: SecureContext | undefined;
	private fallbackAt = 0;

	constructor(caDir: string, hostsDir: string, hosts: string[] = []) {
		this.caDir = caDir;
		this.hostsDir = hostsDir;
		this.hosts = hosts;
	}

	get certPath() {
		return join(this.caDir, 'ca.crt');
	}

	get subject() {
		return this.cert.subject;
	}

	async init({ create }: { create: boolean }) {
		mkdirSync(this.hostsDir, { recursive: true, mode: 0o700 });
		const keyPath = join(this.caDir, 'ca.key');
		if (hasCa(this.caDir)) {
			this.key = await importKey(readFileSync(keyPath, 'utf8'));
			this.cert = new x509.X509Certificate(readFileSync(this.certPath, 'utf8'));
			return;
		}
		if (!create) throw new Error(`no ca.crt and ca.key in ${this.caDir}`);
		mkdirSync(this.caDir, { recursive: true, mode: 0o755 });
		const keys = await subtle.generateKey(algorithm, true, ['sign', 'verify']);
		const now = Date.now();
		this.cert = await x509.X509CertificateGenerator.createSelfSigned({
			serialNumber: serial(),
			name: `CN=cyber-tracker local CA ${randomBytes(3).toString('hex')}, O=cyber-tracker`,
			notBefore: new Date(now - day),
			notAfter: new Date(now + 3650 * day),
			keys,
			signingAlgorithm: algorithm,
			extensions: [
				new x509.BasicConstraintsExtension(true, 0, true),
				new x509.KeyUsagesExtension(
					x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign,
					true
				),
				await x509.SubjectKeyIdentifierExtension.create(keys.publicKey)
			]
		});
		this.key = keys.privateKey;
		writeAtomic(keyPath, await exportKey(keys.privateKey), 0o600);
		writeAtomic(this.certPath, this.cert.toString('pem'));
	}

	async issue(names: string[]) {
		const keys = await subtle.generateKey(algorithm, true, ['sign', 'verify']);
		const now = Date.now();
		const cert = await x509.X509CertificateGenerator.create({
			serialNumber: serial(),
			subject: `CN=${names[0]}`,
			issuer: this.cert.subject,
			notBefore: new Date(now - day),
			notAfter: new Date(now + 390 * day),
			signingKey: this.key,
			publicKey: keys.publicKey,
			signingAlgorithm: algorithm,
			extensions: [
				new x509.BasicConstraintsExtension(false, undefined, true),
				new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true),
				new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.serverAuth]),
				new x509.SubjectAlternativeNameExtension(
					names.map((value) => ({ type: isIP(value) ? ('ip' as const) : ('dns' as const), value }))
				),
				await x509.AuthorityKeyIdentifierExtension.create(this.cert.publicKey),
				await x509.SubjectKeyIdentifierExtension.create(keys.publicKey)
			]
		});
		return {
			key: await exportKey(keys.privateKey),
			cert: cert.toString('pem') + '\n' + this.cert.toString('pem') + '\n'
		};
	}

	private async context(label: string, names: string[]): Promise<SecureContext> {
		const file = join(this.hostsDir, `${label}.pem`);
		const wanted = [...names].sort().join(',');
		if (existsSync(file)) {
			const pem = readFileSync(file, 'utf8');
			const cert = new X509Certificate(pem);
			const san = (cert.subjectAltName ?? '')
				.split(', ')
				.map((entry) => entry.replace(/^(DNS|IP Address):/, '').toLowerCase())
				.sort()
				.join(',');
			const fresh = new Date(cert.validTo).getTime() - Date.now() > 30 * day;
			if (
				fresh &&
				san === wanted &&
				cert.checkIssued(new X509Certificate(this.cert.toString('pem')))
			) {
				return createSecureContext({ key: pem, cert: pem });
			}
		}
		const { key, cert } = await this.issue(names);
		writeAtomic(file, key + '\n' + cert, 0o600);
		return createSecureContext({ key, cert });
	}

	private defaultNames() {
		return [...new Set(['localhost', '127.0.0.1', '::1', ...this.hosts])];
	}

	async defaultContext(): Promise<SecureContext> {
		if (!this.fallback || Date.now() - this.fallbackAt > day) {
			this.fallback = await this.context('_default', this.defaultNames());
			this.fallbackAt = Date.now();
			this.contexts.clear();
		}
		return this.fallback;
	}

	defaultPem() {
		const pem = readFileSync(join(this.hostsDir, '_default.pem'), 'utf8');
		return { key: pem, cert: pem };
	}

	async contextFor(servername?: string): Promise<SecureContext> {
		const name = servername?.toLowerCase().replace(/\.$/, '');
		if (!name || !isLocalName(name, this.hosts)) return this.defaultContext();
		const cached = this.contexts.get(name);
		if (cached) return cached;
		let pending = this.pending.get(name);
		if (!pending) {
			pending = this.context(name, [name]).then((context) => {
				this.contexts.set(name, context);
				this.pending.delete(name);
				return context;
			});
			this.pending.set(name, pending);
		}
		return pending;
	}
}

class FileCertificate implements CertificateSource {
	private readonly certPath: string;
	private readonly keyPath: string;
	private mtime = 0;
	private checked = 0;
	private secure!: SecureContext;

	constructor(certPath: string, keyPath: string) {
		this.certPath = certPath;
		this.keyPath = keyPath;
		this.load();
	}

	private load() {
		this.mtime = statSync(this.certPath).mtimeMs + statSync(this.keyPath).mtimeMs;
		this.secure = createSecureContext({
			cert: readFileSync(this.certPath),
			key: readFileSync(this.keyPath)
		});
		this.checked = Date.now();
	}

	async contextFor() {
		if (Date.now() - this.checked > 60_000) {
			this.checked = Date.now();
			try {
				const mtime = statSync(this.certPath).mtimeMs + statSync(this.keyPath).mtimeMs;
				if (mtime !== this.mtime) this.load();
			} catch (error) {
				console.error('Could not reload the TLS certificate:', (error as Error).message);
			}
		}
		return this.secure;
	}

	defaultContext(): Promise<SecureContext> {
		return this.contextFor();
	}

	defaultPem() {
		return { key: readFileSync(this.keyPath), cert: readFileSync(this.certPath) };
	}
}

export type Certificates =
	| { mode: 'custom'; source: CertificateSource; note: string }
	| { mode: 'shared-ca' | 'own-ca'; source: LocalCa; note: string };

export async function createCertificates(
	env: Record<string, string | undefined>,
	dataDir: string
): Promise<Certificates> {
	if (env.TLS_CERT || env.TLS_KEY) {
		if (!env.TLS_CERT || !env.TLS_KEY) throw new Error('Set both TLS_CERT and TLS_KEY');
		return {
			mode: 'custom',
			source: new FileCertificate(env.TLS_CERT, env.TLS_KEY),
			note: `HTTPS with the certificate in ${env.TLS_CERT}`
		};
	}

	const hosts = parseHosts(env.TLS_HOSTS);
	const hostsDir = join(dataDir, 'tls', 'hosts');
	const shared = env.TLS_CA_DIR;
	let warning = '';
	if (shared && hasCa(shared)) {
		try {
			const ca = new LocalCa(shared, hostsDir, hosts);
			await ca.init({ create: false });
			await ca.defaultContext();
			return {
				mode: 'shared-ca',
				source: ca,
				note: `HTTPS signed by the existing certificate authority in ${shared} (${ca.subject})`
			};
		} catch (error) {
			warning = `Can't use the CA in TLS_CA_DIR ${shared} (${(error as Error).message}), using this app's own CA. `;
		}
	} else if (shared) {
		warning = `TLS_CA_DIR ${shared} has no ca.crt and ca.key, using this app's own CA. `;
	}

	const ca = new LocalCa(join(dataDir, 'tls'), hostsDir, hosts);
	await ca.init({ create: true });
	await ca.defaultContext();
	return {
		mode: 'own-ca',
		source: ca,
		note:
			warning +
			`HTTPS signed by this app's own certificate authority (${ca.certPath}). ` +
			'Browsers warn until it is installed, or point TLS_CA_DIR at a CA your devices already trust.'
	};
}
