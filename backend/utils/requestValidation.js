// Server-side copy of frontend/src/data/requestValidation.js.
// Keep the field list and the allowed-character rule in sync with that file.
//
// Purpose and Remark are free-form prose and accept anything the Maker types.
// Every other typed field on the Request page is an identifier, a name or a
// department - none of which need punctuation - so they are restricted to
// letters, digits and spaces. The browser check is a convenience; this one is
// the rule, since a payload can reach the API without going through the form.

const SPECIAL_CHARACTER = /[^a-zA-Z0-9 ]/;


const RESTRICTED_FIELD_LABELS = {
    requestedForEmployeeId: "Requested For Employee ID",
    department: "Department",
    designation: "Designation",
    vendorName: "Vendor Name",
    thirdPartyId: "Third Party ID"
};


function hasSpecialCharacter(value) {

    return SPECIAL_CHARACTER.test(String(value ?? ""));

}


// Which restricted fields are actually in play - Designation is replaced by
// the vendor fields on a Third Party request, and the employee ID only shows
// when the letter is for someone else.
function activeRestrictedFields(requestedFor) {

    const fields = ["department"];

    if (requestedFor === "Others") {
        fields.push("requestedForEmployeeId");
    }

    if (requestedFor === "Third Party") {
        fields.push("vendorName", "thirdPartyId");
    } else {
        fields.push("designation");
    }

    return fields;

}


// Throws a 400 naming every offending field; returns silently when clean.
function assertNoSpecialCharacters(data) {

    const offending = activeRestrictedFields(data.requestedFor).filter(
        (field) => hasSpecialCharacter(data[field])
    );

    if (offending.length === 0) {
        return;
    }

    const names = offending.map((field) => RESTRICTED_FIELD_LABELS[field]);

    const error = new Error(
        `Special characters are not allowed in ${names.join(", ")}. ` +
        "Only letters, numbers and spaces are accepted outside Purpose and Remark."
    );

    error.status = 400;

    throw error;

}


module.exports = {

    SPECIAL_CHARACTER,

    RESTRICTED_FIELD_LABELS,

    hasSpecialCharacter,

    activeRestrictedFields,

    assertNoSpecialCharacters

};
