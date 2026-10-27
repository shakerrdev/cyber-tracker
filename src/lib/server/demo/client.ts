import { CybershokeError, type CybershokeClient } from '../cybershoke/client.ts';
import type { RawProfile, RawServerData } from '../cybershoke/types.ts';
import type { SimPlayer } from './sim.ts';

export interface DemoSchedule {
	firstJoinSec: number;
	stintSec: number;
	offlineSec: number;
	modes: number[];
}

export const DEFAULT_SCHEDULE: DemoSchedule = {
	firstJoinSec: 0,
	stintSec: 8 * 60,
	offlineSec: 4 * 60,
	modes: [11, 11, 11, 15, 22, 29]
};

export class DemoClient implements CybershokeClient {
	private readonly player: SimPlayer;
	private readonly schedule: DemoSchedule;
	private readonly now: () => number;
	private nextChangeAt: number;
	private stintsLeft = 0;
	private turn = 0;

	constructor(
		player: SimPlayer,
		schedule = DEFAULT_SCHEDULE,
		now = () => Math.floor(Date.now() / 1000)
	) {
		this.player = player;
		this.schedule = schedule;
		this.now = now;
		this.nextChangeAt = now() + schedule.firstJoinSec;
	}

	async profile(steamid64: string): Promise<RawProfile> {
		if (steamid64 !== this.player.steamid64) throw new CybershokeError('/api/user/data: 404', 404);
		this.step();
		return this.player.profile(this.now());
	}

	async server(ip: string, port: number): Promise<RawServerData> {
		this.step();
		return this.player.server(ip, port, this.now());
	}

	private nextMode(): number {
		const { modes } = this.schedule;
		return modes[this.turn++ % modes.length];
	}

	private step() {
		const t = this.now();
		while (t >= this.nextChangeAt) {
			const at = this.nextChangeAt;
			if (this.player.inGame) {
				this.player.leave(at);
				if (this.stintsLeft > 0) {
					this.stintsLeft--;
					this.player.join(this.nextMode(), at);
					this.nextChangeAt = at + this.schedule.stintSec;
				} else {
					this.nextChangeAt = at + this.schedule.offlineSec;
				}
			} else {
				this.stintsLeft = 1 + (this.turn % 2);
				this.player.join(this.nextMode(), at);
				this.nextChangeAt = at + this.schedule.stintSec;
			}
		}
	}
}
