// src/services/evaluationService.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createEvaluation(jobId, data) {
  const {
    cvMatchRate,
    cvFeedback,
    projectScore,
    projectFeedback,
    overallSummary,
    rawCvScores,
    rawProjectScores,
  } = data;

  return prisma.evaluation.create({
    data: {
      jobId: Number(jobId),
      cvMatchRate,
      cvFeedback,
      projectScore,
      projectFeedback,
      overallSummary,
      rawCvScores: rawCvScores || null,
      rawProjectScores: rawProjectScores || null,
    },
  });
}

module.exports = {
  createEvaluation,
};
