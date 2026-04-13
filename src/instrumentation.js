require('dotenv').config();
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');

if (process.env.DEBUG_OTEL === 'true') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': process.env.OTEL_SERVICE_NAME || 'overwatch-pdf-service',
  }),
  traceExporter: new OTLPTraceExporter(),
  metricExporter: new OTLPMetricExporter(),
  instrumentations: [getNodeAutoInstrumentations({
    // Disable some spammy instrumentations
    '@opentelemetry/instrumentation-fs': { enabled: false },
    '@opentelemetry/instrumentation-dns': { enabled: false },
    '@opentelemetry/instrumentation-net': { enabled: false },
    // Filter out HTTP/HTTPS requests if they are just polling
    '@opentelemetry/instrumentation-http': {
      ignoreOutgoingRequestHook: (request) => {
        // Ignore polling the metrics endpoint or local redis/bullmq network noise
        if (request.host === 'record-metrics.contrails.ai') {
          return true;
        }
        return false;
      }
    }
  })],
});

sdk.start();

console.log('OpenTelemetry initialized');

// Export flush function to be called at the end of each Lambda invocation
module.exports = {
  forceFlush: async () => {
    try {
      if (sdk._tracerProvider && typeof sdk._tracerProvider.forceFlush === 'function') {
        await sdk._tracerProvider.forceFlush();
      }
      if (sdk._meterProvider && typeof sdk._meterProvider.forceFlush === 'function') {
        await sdk._meterProvider.forceFlush();
      }
    } catch (e) {
      console.error('Error during telemetry force flush:', e);
    }
  }
};
