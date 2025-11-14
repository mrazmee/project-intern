// src/services/jobService.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createJob(jobTitle, cvFileId, reportFileId) {
  return prisma.job.create({
    data: {
      jobTitle,
      cvFileId: Number(cvFileId),
      reportFileId: Number(reportFileId),
      status: "QUEUED",
    },
  });
}

async function getJobWithEvaluation(jobId) {
  const job = await prisma.job.findUnique({
    where: { id: Number(jobId) },
    include: { evaluation: true },
  });
  if (!job) return null;
  return { job, evaluation: job.evaluation };
}

module.exports = {
  createJob,
  getJobWithEvaluation,
};
