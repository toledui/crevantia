import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { NormsController } from "./norms.controller";
import { NormsService } from "./norms.service";

@Module({
  imports: [DatabaseModule],
  controllers: [NormsController],
  providers: [NormsService],
  exports: [NormsService],
})
export class NormsModule {}
