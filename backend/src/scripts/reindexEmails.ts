import 'dotenv/config';
import prisma from '../config/db';
import { indexEmailStrict } from '../services/emailSearch';

const batchSize = Number(process.env.REINDEX_BATCH_SIZE || 100);

const run = async () => {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const emails = await prisma.email.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (!emails.length) break;

    for (const email of emails) {
      await indexEmailStrict(email);
      total += 1;
    }
    cursor = emails[emails.length - 1].id;
    console.log(`[Reindex] Indexed ${total} email records.`);
  }

  console.log(`[Reindex] Complete. Indexed ${total} records.`);
};

run()
  .catch((error) => {
    console.error('[Reindex] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
