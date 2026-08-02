import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  MetricLabels,
  HistogramOptions,
  CounterOptions,
  GaugeOptions,
  MetricsCollector,
} from './metrics.types';

interface MetricValue {
  value: number;
  labels: MetricLabels;
}

interface HistogramValue {
  sum: number;
  count: number;
  buckets: { le: string; count: number }[];
  labels: MetricLabels;
}

interface StoredMetric {
  type: 'counter' | 'gauge' | 'histogram';
  name: string;
  help: string;
  labelNames: string[];
  values: MetricValue[] | HistogramValue[];
  buckets?: number[];
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@Injectable()
export class MetricsService implements MetricsCollector, OnModuleInit {
  private metrics: Map<string, StoredMetric> = new Map();
  private prefix: string;
  private defaultLabels: MetricLabels;

  constructor(private readonly configService: ConfigService) {
    this.prefix = configService.get<string>('METRICS_PREFIX', 'ecommerce_core_');
    this.defaultLabels = {
      app: 'api',
      env: configService.get<string>('NODE_ENV', 'development'),
    };
  }

  onModuleInit(): void {
    this.registerDefaultMetrics();
  }

  private registerDefaultMetrics(): void {
    this.registerCounter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status', 'store_id'],
    });

    this.registerHistogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'path', 'status', 'store_id'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    });

    this.registerCounter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'store_id'],
    });

    this.registerGauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
      labelNames: ['pool'],
    });

    this.registerGauge({
      name: 'queue_messages_pending',
      help: 'Number of pending messages in queue',
      labelNames: ['queue'],
    });

    this.registerCounter({
      name: 'orders_created_total',
      help: 'Total number of orders created',
      labelNames: ['store_id', 'payment_method'],
    });

    this.registerCounter({
      name: 'checkout_started_total',
      help: 'Total number of checkouts started',
      labelNames: ['store_id'],
    });

    this.registerCounter({
      name: 'checkout_completed_total',
      help: 'Total number of checkouts completed',
      labelNames: ['store_id'],
    });

    this.registerHistogram({
      name: 'checkout_duration_seconds',
      help: 'Duration of checkout process in seconds',
      labelNames: ['store_id'],
      buckets: [1, 5, 10, 30, 60, 120],
    });

    const commercialCounters: CounterOptions[] = [
      { name: 'checkout_success_total', help: 'Committed atomic checkouts', labelNames: ['store_id'] },
      { name: 'checkout_failure_total', help: 'Atomic checkout failures', labelNames: ['store_id', 'reason'] },
      { name: 'checkout_idempotency_replay_total', help: 'Checkout idempotency replays', labelNames: ['store_id', 'operation'] },
      { name: 'checkout_idempotency_conflict_total', help: 'Checkout idempotency conflicts', labelNames: ['store_id'] },
      { name: 'inventory_reservation_failure_total', help: 'Inventory reservation failures', labelNames: ['store_id'] },
      { name: 'inventory_reservation_expired_total', help: 'Expired inventory reservations', labelNames: ['store_id'] },
      { name: 'outbox_claimed_total', help: 'Outbox rows claimed by workers' },
      { name: 'outbox_published_total', help: 'Outbox rows broker-confirmed' },
      { name: 'outbox_retry_total', help: 'Outbox publish retries' },
      { name: 'outbox_failed_total', help: 'Terminal outbox failures' },
      { name: 'outbox_stale_recovered_total', help: 'Stale Outbox locks recovered' },
      { name: 'coupon_concurrency_rejection_total', help: 'Coupon concurrency rejections', labelNames: ['store_id'] },
      { name: 'coupon_reversal_total', help: 'Coupon usages reversed', labelNames: ['store_id'] },
      { name: 'coupon_duplicate_consume_replay_total', help: 'Duplicate coupon consumes replayed', labelNames: ['store_id'] },
      { name: 'loyalty_concurrency_rejection_total', help: 'Loyalty concurrency rejections', labelNames: ['store_id'] },
      { name: 'order_transition_success_total', help: 'Committed order transitions', labelNames: ['store_id', 'command'] },
      { name: 'order_transition_conflict_total', help: 'Conflicting order transitions', labelNames: ['store_id', 'command'] },
      { name: 'order_transition_rejected_total', help: 'Rejected order transitions', labelNames: ['store_id', 'command'] },
      { name: 'fulfillment_transition_success_total', help: 'Committed fulfillment transitions', labelNames: ['store_id', 'command'] },
      { name: 'fulfillment_transition_rejected_total', help: 'Rejected fulfillment transitions', labelNames: ['store_id', 'command'] },
      { name: 'fulfillment_payment_gate_block_total', help: 'Fulfillment payment gate rejections', labelNames: ['store_id'] },
      { name: 'payment_transition_success_total', help: 'Committed payment transitions', labelNames: ['store_id', 'command'] },
      { name: 'payment_transition_conflict_total', help: 'Conflicting payment transitions', labelNames: ['store_id', 'command'] },
      { name: 'payment_expired_total', help: 'Payments expired', labelNames: ['store_id'] },
      { name: 'commercial_override_total', help: 'Commercial overrides used', labelNames: ['store_id', 'command'] },
      { name: 'document_sequence_allocated_total', help: 'Document numbers allocated', labelNames: ['store_id', 'document_type'] },
      { name: 'document_sequence_failure_total', help: 'Document allocation failures', labelNames: ['store_id', 'document_type'] },
      { name: 'webhook_delivery_claimed_total', help: 'Webhook deliveries claimed' },
      { name: 'webhook_delivery_recovered_total', help: 'Stale webhook deliveries recovered' },
      { name: 'webhook_delivery_retry_total', help: 'Webhook deliveries retried' },
      { name: 'webhook_delivery_failed_total', help: 'Webhook deliveries terminally failed' },
    ];
    for (const counter of commercialCounters) this.registerCounter(counter);
  }

  registerCounter(options: CounterOptions): void {
    const name = this.prefix + options.name;
    this.metrics.set(name, {
      type: 'counter',
      name,
      help: options.help,
      labelNames: options.labelNames || [],
      values: [],
    });
  }

  registerGauge(options: GaugeOptions): void {
    const name = this.prefix + options.name;
    this.metrics.set(name, {
      type: 'gauge',
      name,
      help: options.help,
      labelNames: options.labelNames || [],
      values: [],
    });
  }

  registerHistogram(options: HistogramOptions): void {
    const name = this.prefix + options.name;
    this.metrics.set(name, {
      type: 'histogram',
      name,
      help: options.help,
      labelNames: options.labelNames || [],
      values: [],
      buckets: options.buckets || DEFAULT_BUCKETS,
    });
  }

  private getLabelKey(labels: MetricLabels | undefined): string {
    if (!labels) return '{}';
    const sorted = Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(Object.fromEntries(sorted));
  }

  private findMetricValueIndex(metric: StoredMetric, labels: MetricLabels | undefined): number {
    const labelKey = this.getLabelKey(labels);
    return (metric.values as MetricValue[]).findIndex(
      (v) => this.getLabelKey(v.labels) === labelKey,
    );
  }

  incrementCounter(name: string, labels?: MetricLabels, value = 1): void {
    const metricName = this.prefix + name;
    const metric = this.metrics.get(metricName);
    if (!metric || metric.type !== 'counter') return;

    const mergedLabels = { ...this.defaultLabels, ...labels };
    const index = this.findMetricValueIndex(metric, mergedLabels);

    if (index >= 0) {
      (metric.values[index] as MetricValue).value += value;
    } else {
      (metric.values as MetricValue[]).push({ value, labels: mergedLabels });
    }
  }

  decrementCounter(name: string, labels?: MetricLabels, value = 1): void {
    this.incrementCounter(name, labels, -value);
  }

  observeHistogram(name: string, value: number, labels?: MetricLabels): void {
    const metricName = this.prefix + name;
    const metric = this.metrics.get(metricName);
    if (!metric || metric.type !== 'histogram') return;

    const mergedLabels = { ...this.defaultLabels, ...labels };
    const labelKey = this.getLabelKey(mergedLabels);
    const existing = (metric.values as HistogramValue[]).find(
      (v) => this.getLabelKey(v.labels) === labelKey,
    );

    if (existing) {
      existing.sum += value;
      existing.count += 1;
      for (const bucket of existing.buckets) {
        if (value <= parseFloat(bucket.le)) {
          bucket.count += 1;
        }
      }
    } else {
      const buckets = (metric.buckets || DEFAULT_BUCKETS).map((le) => ({
        le: le.toString(),
        count: value <= le ? 1 : 0,
      }));
      buckets.push({ le: '+Inf', count: 1 });

      (metric.values as HistogramValue[]).push({
        sum: value,
        count: 1,
        buckets,
        labels: mergedLabels,
      });
    }
  }

  setGauge(name: string, value: number, labels?: MetricLabels): void {
    const metricName = this.prefix + name;
    const metric = this.metrics.get(metricName);
    if (!metric || metric.type !== 'gauge') return;

    const mergedLabels = { ...this.defaultLabels, ...labels };
    const index = this.findMetricValueIndex(metric, mergedLabels);

    if (index >= 0) {
      (metric.values[index] as MetricValue).value = value;
    } else {
      (metric.values as MetricValue[]).push({ value, labels: mergedLabels });
    }
  }

  incrementGauge(name: string, labels?: MetricLabels, value = 1): void {
    const metricName = this.prefix + name;
    const metric = this.metrics.get(metricName);
    if (!metric || metric.type !== 'gauge') return;

    const mergedLabels = { ...this.defaultLabels, ...labels };
    const index = this.findMetricValueIndex(metric, mergedLabels);

    if (index >= 0) {
      (metric.values[index] as MetricValue).value += value;
    } else {
      (metric.values as MetricValue[]).push({ value, labels: mergedLabels });
    }
  }

  decrementGauge(name: string, labels?: MetricLabels, value = 1): void {
    this.incrementGauge(name, labels, -value);
  }

  timing(name: string, startTime: number, labels?: MetricLabels): void {
    const duration = (Date.now() - startTime) / 1000;
    this.observeHistogram(name, duration, labels);
  }

  async getMetrics(): Promise<string> {
    const lines: string[] = [];
    lines.push('# HELP ecommerce_core_info Application info');
    lines.push('# TYPE ecommerce_core_info gauge');
    lines.push(`ecommerce_core_info{version="1.0.0"} 1`);
    lines.push('');

    for (const [, metric] of this.metrics) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'histogram') {
        for (const value of metric.values as HistogramValue[]) {
          const labelStr = this.formatLabels(value.labels);
          for (const bucket of value.buckets) {
            const bucketLabels = { ...value.labels, le: bucket.le };
            lines.push(`${metric.name}_bucket${this.formatLabels(bucketLabels)} ${bucket.count}`);
          }
          lines.push(`${metric.name}_sum${labelStr} ${value.sum}`);
          lines.push(`${metric.name}_count${labelStr} ${value.count}`);
        }
      } else {
        for (const value of metric.values as MetricValue[]) {
          const labelStr = this.formatLabels(value.labels);
          lines.push(`${metric.name}${labelStr} ${value.value}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatLabels(labels: MetricLabels): string {
    const entries = Object.entries(labels).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '';

    const formatted = entries.map(([k, v]) => `${k}="${v}"`);
    return `{${formatted.join(',')}}`;
  }
}
