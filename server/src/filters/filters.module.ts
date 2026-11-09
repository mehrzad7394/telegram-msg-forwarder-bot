import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Filter, FilterSchema } from 'src/schemas/filters.schema';
import { FiltersService } from './filters.service';
import { FiltersController } from './filters.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Filter.name, schema: FilterSchema }]),
  ],
  providers: [FiltersService],
  controllers: [FiltersController],
  exports: [FiltersService],
})
export class FiltersModule {}
