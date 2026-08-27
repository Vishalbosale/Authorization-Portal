const requestModel =
    require("../models/requestModel");


const {
    assertNoSpecialCharacters
} = require("../utils/requestValidation");


const createRequest = async (data, user) => {

    assertNoSpecialCharacters(data);

    return await requestModel
        .createRequest(data, user);

};


const getRequests = async (user) => {

    return await requestModel
        .getRequests(user);

};


const getRequestById = async (id, user) => {

    return await requestModel
        .getRequestById(id, user);

};


const takeAction = async (id, action, remark, extra, user) => {

    return await requestModel
        .applyAction(id, action, user, remark, extra);

};


const resubmitRequest = async (id, data, user) => {

    assertNoSpecialCharacters(data);

    return await requestModel
        .resubmitRequest(id, data, user);

};


module.exports = {

    createRequest,

    getRequests,

    getRequestById,

    takeAction,

    resubmitRequest

};
