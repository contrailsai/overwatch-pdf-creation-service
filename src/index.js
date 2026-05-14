require('dotenv').config();
const telemetry = require('./instrumentation');

// Enable Babel for JSX parsing in Node.js
require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react'],
  extensions: ['.js', '.jsx'],
  cache: false, // Disable cache to prevent permission warnings in Lambda
});

const { context, propagation, SpanKind, trace } = require('@opentelemetry/api');
const { connectToMongo, getMongoClient } = require('./mongo');
const {
  generateReportHash,
  normalizePost,
  validatePayload,
  orderPostsByRequestedIds,
} = require('./core-utils');
const { runReportJob } = require('./report-job');

let isMongoConnected = false;

exports.handler = async (event) => {
  try {
    if (!isMongoConnected) {
      await connectToMongo();
      isMongoConnected = true;
    }
    const client = getMongoClient();

    for (const record of event.Records || []) {
      let payload;
      try {
        payload = JSON.parse(record.body);
      } catch (e) {
        console.error('Failed to parse SQS message body', record.body);
        continue;
      }

      const { projectId, postIds, reportType, reportFormat, otelCarrier } = payload;
      const validation = validatePayload(payload);

      if (!validation.valid) {
        console.error('Invalid payload:', validation.errors.join('; '), {
          messageId: record.messageId,
          reportType,
          reportFormat,
          projectId,
        });
        continue;
      }

      let parentContext = context.active();
      if (otelCarrier) {
        parentContext = propagation.extract(parentContext, otelCarrier);
      } else if (record.messageAttributes) {
        const carrier = {};
        for (const [key, attr] of Object.entries(record.messageAttributes)) {
          if (attr.stringValue) carrier[key.toLowerCase()] = attr.stringValue;
        }
        parentContext = propagation.extract(parentContext, carrier);
      }

      try {
        await context.with(parentContext, async () => {
          const tracer = trace.getTracer('overwatch-pdf-service');
          return await tracer.startActiveSpan(
            `sqs.process generate-pdf`,
            {
              kind: SpanKind.CONSUMER,
              attributes: {
                'messaging.system': 'aws_sqs',
                'messaging.operation': 'process',
                'message.id': record.messageId,
                'messaging.message.id': record.messageId,
              },
            },
            async (span) => {
              try {
                span.setAttribute('project.id', projectId);
                span.setAttribute('report.type', reportType);
                span.setAttribute('post.count', postIds.length);

                await runReportJob(client, payload, { persist: 's3' });
                span.end();
              } catch (error) {
                span.recordException(error);
                span.end();
                throw error;
              }
            },
          );
        });
      } catch (recordError) {
        console.error('Record processing failed', {
          messageId: record.messageId,
          projectId,
          reportType,
          error: recordError.message,
        });
        continue;
      }
    }
  } finally {
    await telemetry.forceFlush();
  }
};

module.exports = {
  handler: exports.handler,
  generateReportHash,
  normalizePost,
  validatePayload,
  orderPostsByRequestedIds,
};
