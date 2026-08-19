import AppError from "./appError";

async function findOrFail(model: any, id: number, notFoundMessage: string) {
  const record = await model.findUnique({ where: { id: Number(id) } });
  if (!record) throw new AppError(404, notFoundMessage);
  return record;
}

module.exports = findOrFail;
