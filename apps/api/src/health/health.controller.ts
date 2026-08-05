import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { getRedisProvider } from '@platform/redis';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Estado de salud de la API' })
  async check(): Promise<{
    status: 'ok' | 'degraded';
    uptimeSeconds: number;
    redis: 'ok' | 'down';
    timestamp: string;
  }> {
    const redisState: 'ok' | 'down' = await this.pingRedis();
    return {
      status: redisState === 'ok' ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      redis: redisState,
      timestamp: new Date().toISOString(),
    };
  }

  private async pingRedis(): Promise<'ok' | 'down'> {
    try {
      const pong = await getRedisProvider().ping();
      return pong === 'PONG' ? 'ok' : 'down';
    } catch {
      return 'down';
    }
  }
}
