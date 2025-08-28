import { writeFileSync, mkdirSync } from 'node:fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ReviewSchema } from '../../libs/js-core/src/schema/review';
mkdirSync('schemas', { recursive: true });
const json = zodToJsonSchema(ReviewSchema, 'Review');
writeFileSync('schemas/review.schema.json', JSON.stringify(json, null, 2));
console.log('schemas/review.schema.json written');
