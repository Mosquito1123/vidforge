-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_modelId_fkey";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "tool" TEXT NOT NULL DEFAULT 'generate',
ALTER COLUMN "modelId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;
