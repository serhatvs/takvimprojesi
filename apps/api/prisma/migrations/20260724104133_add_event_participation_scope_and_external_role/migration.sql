-- CreateEnum
CREATE TYPE "EventParticipationScope" AS ENUM ('AGU_ONLY', 'EXTERNAL_ALLOWED');

-- AlterEnum
ALTER TYPE "RoleName" ADD VALUE 'EXTERNAL_PARTICIPANT';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "participationScope" "EventParticipationScope" NOT NULL DEFAULT 'AGU_ONLY';
