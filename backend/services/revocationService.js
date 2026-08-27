const revocationModel =
    require("../models/revocationModel");


const getRevocations = async (user) => {

    return await revocationModel
        .getRevocations(user);

};


const createRevocation = async (requestId, payload, user) => {

    return await revocationModel
        .createRevocation(requestId, payload, user);

};


const takeAction = async (id, action, remark, user) => {

    return await revocationModel
        .applyRevocationAction(id, action, user, remark);

};


module.exports = {

    getRevocations,

    createRevocation,

    takeAction

};
