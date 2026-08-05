import { Global, Module } from '@nestjs/common';
import { getDatabase, type Database } from '@platform/db';

export const DATABASE = Symbol('DATABASE');

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (): Database => getDatabase(),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}