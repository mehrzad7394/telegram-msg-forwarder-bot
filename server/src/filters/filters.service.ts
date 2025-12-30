import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Filter } from 'src/schemas/filters.schema';
import { CreateFilterDto, UpdateFilterDto } from './dto/filter.dto';
import { FilterActions } from 'src/types/types';

@Injectable()
export class FiltersService implements OnModuleInit {
  private readonly logger = new Logger(FiltersService.name);
  private activeFilters: Filter[] = [];

  constructor(@InjectModel(Filter.name) private filterModel: Model<Filter>) {}
  async onModuleInit() {
    await this.loadFilters();
  }
  async loadFilters() {
    this.activeFilters = await this.filterModel.find({ isActive: true }).exec();
    this.logger.log(`Loaded ${this.activeFilters.length} active filters`);
  }

  clearCache() {
    this.activeFilters = [];
  }
  getActiveFilters(): Filter[] {
    return this.activeFilters;
  }
  async findAll(): Promise<Filter[]> {
    return this.filterModel.find().sort({ createdAt: -1 }).exec();
  }
  async findById(id: string): Promise<Filter> {
    const filter = await this.filterModel.findById(id).exec();
    if (!filter) {
      throw new Error('Filter not found');
    }
    return filter;
  }
  async create(createFilterDto: CreateFilterDto): Promise<Filter> {
    const filter = new this.filterModel(createFilterDto);
    const savedFilter = await filter.save();
    //Reload active filters if this filter is active
    if (savedFilter.isActive) {
      await this.loadFilters();
    }
    return savedFilter;
  }

  async update(id: string, updatedFilterDto: UpdateFilterDto): Promise<Filter> {
    const filter = await this.filterModel.findByIdAndUpdate(
      id,
      updatedFilterDto,
      { new: true },
    );
    if (!filter) {
      throw new Error('Filter not found');
    }
    //Reload active filters
    await this.loadFilters();

    return filter;
  }
  async delete(id: string): Promise<void> {
    const result = await this.filterModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new Error('Filter not found');
    }
    // Reload active filters
    await this.loadFilters();
  }

  async activateFilter(id: string): Promise<Filter> {
    return this.update(id, { isActive: true });
  }
  async deactivateFilter(id: string): Promise<Filter> {
    return this.update(id, { isActive: false });
  }
  async getFiltersByAction(action: FilterActions): Promise<Filter[]> {
    return this.filterModel.find({ action, isActive: true }).exec();
  }
}
