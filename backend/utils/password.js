const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;


async function hashPassword(password) {

    return await bcrypt.hash(
        password,
        SALT_ROUNDS
    );

}


async function comparePassword(
    password,
    passwordHash
) {

    return await bcrypt.compare(
        password,
        passwordHash
    );

}


module.exports = {

    hashPassword,

    comparePassword

};