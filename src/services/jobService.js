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

// dipakai worker untuk ambil 1 job yang masih QUEUED
async function getNextQueuedJob() {
  return prisma.job.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });
}

async function markJobProcessing(jobId) {
  return prisma.job.update({
    where: { id: Number(jobId) },
    data: { status: "PROCESSING" },
  });
}

async function markJobCompleted(jobId) {
  return prisma.job.update({
    where: { id: Number(jobId) },
    data: { status: "COMPLETED" },
  });
}

async function markJobFailed(jobId) {
  return prisma.job.update({
    where: { id: Number(jobId) },
    data: { status: "FAILED" },
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
  getNextQueuedJob,
  markJobProcessing,
  markJobCompleted,
  markJobFailed,
  getJobWithEvaluation,
};
