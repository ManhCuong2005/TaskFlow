'use strict';
const leaderRepository = require('../database/leader.repository');
const { success } = require('../utils/response');

async function getOverview(req, res, next) {
  try {
    return success(
      res,
      await leaderRepository.getOverview(req.params.id, req.user)
    );
  } catch (error) {
    next(error);
  }
}

async function updatePermissions(req, res, next) {
  try {
    const result = await leaderRepository.updatePermissions(
      req.params.id,
      req.params.userId,
      req.body,
      req.user
    );
    return success(res, result, 'Đã cập nhật quyền thành viên trong dự án.');
  } catch (error) {
    next(error);
  }
}

module.exports = { getOverview, updatePermissions };
