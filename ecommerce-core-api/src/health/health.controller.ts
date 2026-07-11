import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiOperation } from '@nestjs/swagger';
import type { HealthResponse } from '../common/types/shared.types';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService, type DetailedHealthResponse, type ComponentHealth } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('debug/version')
  @Public()
  @ApiOperation({ summary: 'Debug version info' })
  debugVersion() {
    return {
      version: 'products-cast-fix-2026-05-04-2358',
      time: new Date().toISOString(),
    };
  }

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe - check if app is running' })
  @ApiOkResponse({ description: 'Application is alive' })
  getLive(): HealthResponse {
    return this.healthService.getLive();
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe - check if app can serve traffic' })
  @ApiOkResponse({ description: 'Application readiness status' })
  async getReady(): Promise<HealthResponse> {
    return this.healthService.getReady();
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Detailed health check with all components' })
  @ApiOkResponse({ description: 'Detailed health status' })
  async getRootHealth(): Promise<DetailedHealthResponse> {
    return this.healthService.getDetailed();
  }

  @Get('detail')
  @Public()
  @ApiOperation({ summary: 'Detailed health check with all components' })
  @ApiOkResponse({ description: 'Detailed health status' })
  async getDetailed(): Promise<DetailedHealthResponse> {
    return this.healthService.getDetailed();
  }

  @Get('component/:name')
  @Public()
  @ApiOperation({ summary: 'Check health of specific component' })
  @ApiOkResponse({ description: 'Component health status' })
  async getComponentHealth(@Param('name') name: string): Promise<ComponentHealth> {
    const validComponents = ['postgres', 'redis', 'rabbitmq', 'storage'];
    if (!validComponents.includes(name)) {
      throw new NotFoundException(
        `Unknown component: ${name}. Valid components: ${validComponents.join(', ')}`,
      );
    }
    return this.healthService.getComponentHealth(name);
  }
}
