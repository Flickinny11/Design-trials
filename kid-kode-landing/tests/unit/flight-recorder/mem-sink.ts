// Test helpers — in-memory + throwing sinks for the flight-recorder writer.
// (Not a *.test.ts file, so vitest does not collect it as a suite.)
import type { FlightSink } from '@/lib/flight-recorder/sinks';
import type { FlightRecord } from '@/lib/flight-recorder/schema';

/** Collects everything written; used to assert routing + scrub outcomes. */
export class MemorySink implements FlightSink {
  readonly name: string;
  readonly configured = true;
  records: FlightRecord[] = [];
  constructor(name = 'mem') { this.name = name; }
  async write(records: FlightRecord[]): Promise<void> {
    this.records.push(...records);
  }
}

/** Throws on every write — models a total sink outage (fail-open proof). */
export class ThrowingSink implements FlightSink {
  readonly name = 'throwing';
  readonly configured = true;
  attempts = 0;
  async write(_records: FlightRecord[]): Promise<void> {
    this.attempts += 1;
    throw new Error('sink outage (simulated)');
  }
}
