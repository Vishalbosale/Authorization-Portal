// Client-side mirror of backend/utils/requestValidation.js.
// Keep the field list and the allowed-character rule in sync with that file.
//
// Purpose and Remark are free-form prose and accept anything the Maker types.
// Every other typed field on the Request page is an identifier, a name or a
// department - none of which need punctuation - so they are restricted to
// letters, digits and spaces.

export const SPECIAL_CHARACTER = /[^a-zA-Z0-9 ]/;


export const RESTRICTED_FIELD_LABELS = {
    requestedForEmployeeId: "Requested For Employee ID",
    department: "Department",
    designation: "Designation",
    vendorName: "Vendor Name",
    thirdPartyId: "Third Party ID"
};


export function hasSpecialCharacter(value) {

    return SPECIAL_CHARACTER.test(String(value ?? ""));

}


export function specialCharacterMessage(field) {

    return `${RESTRICTED_FIELD_LABELS[field] || field} may contain only letters, numbers and spaces.`;

}


// Which restricted fields are actually in play - Designation is replaced by
// the vendor fields on a Third Party request, and the employee ID only shows
// when the letter is for someone else.
export function activeRestrictedFields(requestedFor) {

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


// Returns { field: message } for every restricted field carrying a special
// character; an empty object means the form is clean.
export function validateRestrictedFields(form) {

    const problems = {};

    for (const field of activeRestrictedFields(form.requestedFor)) {

        if (hasSpecialCharacter(form[field])) {
            problems[field] = specialCharacterMessage(field);
        }

    }

    return problems;

}
