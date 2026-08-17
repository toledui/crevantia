import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { ResultsController } from "./results.controller";
import { ResultsService } from "./results.service";

@Module({
  imports: [DatabaseModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
