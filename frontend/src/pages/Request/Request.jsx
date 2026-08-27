import {
    useEffect,
    useMemo,
    useState
} from "react";


import {
    useAuth
} from "../../context/AuthContext";


import {
    useRequests
} from "../../context/RequestsContext";


import {
    STAGE,
    STAGE_LABELS,
    formatDateTime
} from "../../data/workflow";


import {
    RESTRICTED_FIELD_LABELS,
    hasSpecialCharacter,
    specialCharacterMessage,
    validateRestrictedFields
} from "../../data/requestValidation";


import "./Request.css";

const API_URL = "/api";


function getTodayDate() {

    const today = new Date();

    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

}


function createEmptyForm() {

    return {

    letterType: "",

    requestedFor: "Self",

    requestedForEmployeeId: "",

    department: "",

    designation: "",

    initiateDate: getTodayDate(),

    expiryDate: "",

    purpose: "",

    remark: "",

    vendorName: "",

    thirdPartyId: "",

    kycDocument: "",

    kycDocumentData: "",

    dueDiligenceDocument: "",

    dueDiligenceDocumentData: ""

    };

}


function readFileAsDataUrl(file) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);

        reader.readAsDataURL(file);

    });

}


function downloadExistingDocument(documentData) {

    if (!documentData?.data) {
        return;
    }

    const link = document.createElement("a");
    link.href = documentData.data;
    link.download = documentData.fileName || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

}


function Request() {

    const { user } =
        useAuth();

    const {
        requests,
        createRequest,
        resubmitRequest
    } = useRequests();


    const [
        editingId,
        setEditingId
    ] = useState(null);

    const [
        formData,
        setFormData
    ] = useState(createEmptyForm);

    const [
        approvers,
        setApprovers
    ] = useState({

        hod: "",

        ormdHead: "",

        cooEd: "",

        secretarial: ""

    });

    const [
        successInfo,
        setSuccessInfo
    ] = useState(null);

    const [
        approverOptions,
        setApproverOptions
    ] = useState({
        HOD: [],
        ORMD_HEAD: [],
        COO_ED: [],
        SECRETARIAL: []
    });

    const [
        existingDocuments,
        setExistingDocuments
    ] = useState({ kyc: null, dueDiligence: null });

    const [
        fieldErrors,
        setFieldErrors
    ] = useState({});

    useEffect(() => {

        fetch(`${API_URL}/api/employees/approvers`, { credentials: "include" })
            .then((response) => response.json())
            .then((body) => {
                if (body.data) {
                    setApproverOptions(body.data);
                }
            })
            .catch((error) => console.error("Failed to load approvers:", error));

    }, []);


    const myReturnedRequests = useMemo(() => {

        if (!user) {
            return [];
        }

        return requests.filter(
            (request) =>
                request.status === STAGE.REQUESTER_REVISION &&
                request.requestor?.employeeId === user.employeeId
        );

    }, [requests, user]);


    const handleChange = (event) => {

        const {
            name,
            value
        } = event.target;


        setFormData(
            previous => ({

                ...previous,

                [name]: value

            })
        );


        // Flag a restricted field as it is typed, so the Maker is not told
        // about it for the first time after filling in the whole form.
        if (RESTRICTED_FIELD_LABELS[name]) {

            setFieldErrors(
                previous => ({

                    ...previous,

                    [name]: hasSpecialCharacter(value)
                        ? specialCharacterMessage(name)
                        : ""

                })
            );

        }

    };


    const handleApproverChange =
        (event) => {

            const {
                name,
                value
            } = event.target;


            setApprovers(
                previous => ({

                    ...previous,

                    [name]: value

                })
            );

        };


    const resetForm = () => {

        setEditingId(null);
        setFormData(createEmptyForm());
        setApprovers({ hod: "", ormdHead: "", cooEd: "", secretarial: "" });
        setExistingDocuments({ kyc: null, dueDiligence: null });
        setFieldErrors({});

    };


    const handleEditReturned = (request) => {

        const kycDocument = request.documentAttachments?.find(
            (document) => document.type === "KYC"
        ) || null;
        const dueDiligenceDocument = request.documentAttachments?.find(
            (document) => document.type === "DUE_DILIGENCE"
        ) || null;

        setEditingId(request.id);

        setExistingDocuments({
            kyc: kycDocument,
            dueDiligence: dueDiligenceDocument
        });

        setFormData({

            letterType: request.letterType,
            requestedFor: request.requestedFor,
            requestedForEmployeeId: request.requestedForEmployeeId || "",
            department: request.department,
            designation: request.designation || "",
            initiateDate: request.initiateDate,
            expiryDate: request.expiryDate,
            purpose: request.purpose,
            remark: "",
            vendorName: request.vendorName || "",
            thirdPartyId: request.thirdPartyId || "",
            kycDocument: request.documents?.[0] || "",
            kycDocumentData: "",
            dueDiligenceDocument: request.documents?.[1] || "",
            dueDiligenceDocumentData: ""

        });

        setApprovers({
            hod: request.approvers?.hod || "",
            ormdHead: request.approvers?.ormdHead || "",
            cooEd: request.approvers?.cooEd || "",
            secretarial: request.approvers?.secretarial || ""
        });

        setSuccessInfo(null);
        setFieldErrors({});

        window.scrollTo({ top: 0, behavior: "smooth" });

    };


    const [submitting, setSubmitting] = useState(false);


    const handleSubmit =
        async (event) => {

            event.preventDefault();


            // Only Purpose and Remark take free-form text; everything else
            // has to be letters, numbers and spaces.
            const restrictedProblems = validateRestrictedFields(formData);

            if (Object.keys(restrictedProblems).length > 0) {

                setFieldErrors(restrictedProblems);

                alert(
                    "Special characters are not allowed outside Purpose and Remark:\n\n" +
                    Object.values(restrictedProblems).join("\n")
                );

                return;

            }

            setFieldErrors({});


            if (
                !approvers.hod ||
                !approvers.ormdHead ||
                    !approvers.cooEd ||
                    !approvers.secretarial
            ) {

                alert(
                    "Please select all four approvers (HOD, ORMD Head, COO / ED, Secretarial)."
                );

                return;

            }

            const payload = {

                letterType: formData.letterType,
                requestedFor: formData.requestedFor,
                requestedForEmployeeId: formData.requestedForEmployeeId,
                department: formData.department,
                designation: formData.designation,
                initiateDate: formData.initiateDate,
                expiryDate: formData.expiryDate,
                purpose: formData.purpose,
                remark: formData.remark,
                vendorName: formData.vendorName,
                thirdPartyId: formData.thirdPartyId,
                kycDocument: formData.kycDocument,
                kycDocumentData: formData.kycDocumentData,
                dueDiligenceDocument: formData.dueDiligenceDocument,
                dueDiligenceDocumentData: formData.dueDiligenceDocumentData,
                approvers

            };


            setSubmitting(true);

            try {

                if (editingId) {

                    const requestReturnStage = requests.find(
                        (request) => request.id === editingId
                    )?.returnStage;

                    await resubmitRequest(
                        editingId,
                        { ...payload, resubmitRemark: formData.remark }
                    );

                    setSuccessInfo({
                        id: editingId,
                        message: `Request resubmitted successfully. It has moved directly to the ${STAGE_LABELS[requestReturnStage] || "approver's"} bucket.`
                    });

                } else {

                    const created = await createRequest(payload);

                    setSuccessInfo({
                        id: created.id,
                        message: "Request submitted successfully. It has entered the HOD Bucket for approval."
                    });

                }

                resetForm();

            } catch (error) {

                console.error("Failed to submit request:", error);

                alert(
                    error.message ||
                    "Unable to submit this request. Please try again."
                );

            } finally {

                setSubmitting(false);

            }

        };


    const isThirdParty =
        formData.requestedFor ===
        "Third Party";

    const editingRequest = editingId
        ? requests.find((request) => request.id === editingId)
        : null;

    const editingApproverLabel = editingRequest?.returnStage
        ? STAGE_LABELS[editingRequest.returnStage]
        : "the assigned approver";


    const isOthers =
        formData.requestedFor ===
        "Others";


    return (

        <div className="request-page">


            <div className="page-title">

                <div>

                    <h1>
                        {editingId
                            ? `Edit Request ${editingId}`
                            : "Create Authorization Request"}
                    </h1>

                    <p>
                        {editingId
                            ? `Update the details below and resubmit. The request will go directly back to the ${editingApproverLabel} Bucket.`
                            : "Enter request details and select all required approvers."}
                    </p>

                </div>

            </div>


            {successInfo && (

                <div className="success-banner">

                    <div>
                        <strong>{successInfo.id}</strong>
                        <span>{successInfo.message}</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setSuccessInfo(null)}
                    >
                        Dismiss
                    </button>

                </div>

            )}


            {myReturnedRequests.length > 0 && !editingId && (

                <div className="returned-panel">

                    <h2>
                        Requester Bucket - Sent Back for Correction
                    </h2>

                    <p className="section-description">
                        The assigned approver sent these requests back with remarks.
                        Review the remark, update the request, and resubmit -
                        each request will return directly to the approver who sent it back.
                    </p>

                    {myReturnedRequests.map((request) => {

                        const lastRemark = [...request.audit]
                            .reverse()
                            .find((entry) => entry.toStage === STAGE.REQUESTER_REVISION);

                        return (

                            <div
                                className="returned-card"
                                key={request.id}
                            >

                                <div>

                                    <strong>{request.id}</strong>

                                    <span>
                                        {request.letterType} - {request.purpose}
                                    </span>

                                    {lastRemark && (

                                        <p className="returned-remark">
                                            "{lastRemark.remark}"
                                            <em>
                                                {" "}- {lastRemark.actor}, {formatDateTime(lastRemark.timestamp)}
                                            </em>
                                        </p>

                                    )}

                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleEditReturned(request)}
                                >
                                    Edit &amp; Resubmit
                                </button>

                            </div>

                        );

                    })}

                </div>

            )}


            <form
                className="request-form"
                onSubmit={handleSubmit}
            >


                {/* REQUESTOR */}

                <section className="form-section">

                    <h2>
                        Requestor Information
                    </h2>


                    <div className="form-grid">


                        <div className="form-group">

                            <label>
                                Employee ID
                            </label>

                            <input
                                value={
                                    user?.employeeId ||
                                    ""
                                }
                                disabled
                            />

                        </div>


                        <div className="form-group">

                            <label>
                                Employee Name
                            </label>

                            <input
                                value={
                                    user?.employeeName ||
                                    ""
                                }
                                disabled
                            />

                        </div>


                    </div>

                </section>


                {/* REQUEST DETAILS */}

                <section className="form-section">

                    <h2>
                        Request Details
                    </h2>


                    <div className="form-grid">


                        <div className="form-group">

                            <label>
                                Letter Type *
                            </label>

                            <select
                                name="letterType"
                                value={
                                    formData.letterType
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            >

                                <option value="">
                                    Select Letter Type
                                </option>

                                <option value="Authorization Letter">
                                    AL- Authorization Letter
                                </option>

                                <option value="POA- Power of Attorney">
                                    POA- Power of Attorney
                                </option>

                            </select>

                        </div>


                        <div className="form-group">

                            <label>
                                Requested For *
                            </label>

                            <select
                                name="requestedFor"
                                value={
                                    formData.requestedFor
                                }
                                onChange={
                                    handleChange
                                }
                            >

                                <option value="Self">
                                    Self
                                </option>

                                <option value="Others">
                                    Others
                                </option>

                                <option value="Third Party">
                                    Third Party
                                </option>

                            </select>

                        </div>


                        {isOthers && (

                            <div className="form-group">

                                <label>
                                    Requested For Employee ID *
                                </label>

                                <input
                                    name="requestedForEmployeeId"
                                    className={
                                        fieldErrors.requestedForEmployeeId
                                            ? "is-invalid"
                                            : undefined
                                    }
                                    value={
                                        formData.requestedForEmployeeId
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    placeholder="Employee ID"
                                    required
                                />

                                {fieldErrors.requestedForEmployeeId && (
                                    <span className="field-error">
                                        {fieldErrors.requestedForEmployeeId}
                                    </span>
                                )}

                            </div>

                        )}


                        <div className="form-group">

                              <label>
                                    Department *
                                </label>

                                <input
                                    name="department"
                                    className={
                                        fieldErrors.department
                                            ? "is-invalid"
                                            : undefined
                                    }
                                    value={
                                        formData.department
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    placeholder="Department"
                                    required
                                />

                                {fieldErrors.department && (
                                    <span className="field-error">
                                        {fieldErrors.department}
                                    </span>
                                )}

                        </div>


                        {!isThirdParty && (

                            <div className="form-group">

                                <label>
                                    Designation *
                                </label>

                                <input
                                    name="designation"
                                    className={
                                        fieldErrors.designation
                                            ? "is-invalid"
                                            : undefined
                                    }
                                    value={
                                        formData.designation
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    placeholder="Designation"
                                    required
                                />

                                {fieldErrors.designation && (
                                    <span className="field-error">
                                        {fieldErrors.designation}
                                    </span>
                                )}

                            </div>

                        )}


                        <div className="form-group">

                            <label>
                                Initiate Date *
                            </label>

                            <input
                                type="date"
                                name="initiateDate"
                                value={
                                    formData.initiateDate
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />

                        </div>


                        <div className="form-group">

                            <label>
                                Expiry Date
                            </label>

                            <input
                                type="date"
                                name="expiryDate"
                                value={
                                    formData.expiryDate
                                }
                                onChange={
                                    handleChange
                                }
                            />

                        </div>


                    </div>

                </section>


                {/* THIRD PARTY */}

                {isThirdParty && (

                    <section className="form-section">

                        <h2>
                            Third Party Information
                        </h2>


                        <div className="form-grid">


                            <div className="form-group">

                                <label>
                                    Vendor Name *
                                </label>

                                <input
                                    name="vendorName"
                                    className={
                                        fieldErrors.vendorName
                                            ? "is-invalid"
                                            : undefined
                                    }
                                    value={
                                        formData.vendorName
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    required
                                />

                                {fieldErrors.vendorName && (
                                    <span className="field-error">
                                        {fieldErrors.vendorName}
                                    </span>
                                )}

                            </div>


                            <div className="form-group">

                                <label>
                                    Third Party ID *
                                </label>

                                <input
                                    name="thirdPartyId"
                                    className={
                                        fieldErrors.thirdPartyId
                                            ? "is-invalid"
                                            : undefined
                                    }
                                    value={
                                        formData.thirdPartyId
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    required
                                />

                                {fieldErrors.thirdPartyId && (
                                    <span className="field-error">
                                        {fieldErrors.thirdPartyId}
                                    </span>
                                )}

                            </div>


                            <div className="form-group">

                                <label>
                                    KYC Document *
                                </label>

                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={async (event) => {

                                        const file = event.target.files?.[0];

                                        if (!file) {
                                            return;
                                        }

                                        const dataUrl = await readFileAsDataUrl(file);

                                        setFormData((previous) => ({
                                            ...previous,
                                            kycDocument: file.name,
                                            kycDocumentData: dataUrl
                                        }));

                                    }}
                                    required={editingId ? false : true}
                                />

                                {editingId && existingDocuments.kyc && !formData.kycDocumentData && (
                                    <div className="existing-document">
                                        <span>Previously uploaded: {existingDocuments.kyc.fileName}</span>
                                        <button
                                            type="button"
                                            onClick={() => downloadExistingDocument(existingDocuments.kyc)}
                                        >
                                            Download
                                        </button>
                                    </div>
                                )}

                            </div>


                            <div className="form-group">

                                <label>
                                    Due Diligence Report *
                                </label>

                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={async (event) => {

                                        const file = event.target.files?.[0];

                                        if (!file) {
                                            return;
                                        }

                                        const dataUrl = await readFileAsDataUrl(file);

                                        setFormData((previous) => ({
                                            ...previous,
                                            dueDiligenceDocument: file.name,
                                            dueDiligenceDocumentData: dataUrl
                                        }));

                                    }}
                                    required={editingId ? false : true}
                                />

                                {editingId && existingDocuments.dueDiligence && !formData.dueDiligenceDocumentData && (
                                    <div className="existing-document">
                                        <span>Previously uploaded: {existingDocuments.dueDiligence.fileName}</span>
                                        <button
                                            type="button"
                                            onClick={() => downloadExistingDocument(existingDocuments.dueDiligence)}
                                        >
                                            Download
                                        </button>
                                    </div>
                                )}

                            </div>


                        </div>

                    </section>

                )}


                {/* PURPOSE */}

                <section className="form-section">

                    <h2>
                        Purpose &amp; Remarks
                    </h2>


                    <div className="form-group">

                        <label>
                            Purpose *
                        </label>

                        <textarea
                            name="purpose"
                            value={
                                formData.purpose
                            }
                            onChange={
                                handleChange
                            }
                            rows="4"
                            required
                        />

                    </div>


                    <div className="form-group">

                        <label>
                            Remark
                        </label>

                        <textarea
                            name="remark"
                            value={
                                formData.remark
                            }
                            onChange={
                                handleChange
                            }
                            rows="3"
                        />

                    </div>

                </section>


                {/* APPROVERS */}

                <section className="form-section approver-section">

                    <h2>
                        Select Approvers
                    </h2>

                    <p className="section-description">
                        Select the approvers for each stage of the request's
                        routing chain.
                    </p>


                    <div className="form-grid">


                        <div className="form-group">

                            <label>
                                HOD *
                            </label>

                            <select
                                name="hod"
                                value={
                                    approvers.hod
                                }
                                onChange={
                                    handleApproverChange
                                }
                                required
                            >

                                <option value="">
                                    Select HOD
                                </option>

                                {approverOptions.HOD.map((approver) => (
                                    <option key={approver.employeeId} value={approver.employeeId}>
                                        {approver.employeeName} - {approver.employeeId}
                                    </option>
                                ))}

                            </select>

                        </div>


                        <div className="form-group">

                            <label>
                                ORMD Head *
                            </label>

                            <select
                                name="ormdHead"
                                value={
                                    approvers.ormdHead
                                }
                                onChange={
                                    handleApproverChange
                                }
                                required
                            >

                                <option value="">
                                    Select ORMD Head
                                </option>

                                {approverOptions.ORMD_HEAD.map((approver) => (
                                    <option key={approver.employeeId} value={approver.employeeId}>
                                        {approver.employeeName} - {approver.employeeId}
                                    </option>
                                ))}

                            </select>

                        </div>


                        <div className="form-group">

                            <label>
                                COO / ED *
                            </label>

                            <select
                                name="cooEd"
                                value={
                                    approvers.cooEd
                                }
                                onChange={
                                    handleApproverChange
                                }
                                required
                            >

                                <option value="">
                                    Select COO / ED
                                </option>

                                {approverOptions.COO_ED.map((approver) => (
                                    <option key={approver.employeeId} value={approver.employeeId}>
                                        {approver.employeeName} - {approver.employeeId}
                                    </option>
                                ))}

                            </select>

                        </div>


                        <div className="form-group">

                            <label>
                                Secretarial Approver *
                            </label>

                            <select
                                name="secretarial"
                                value={
                                    approvers.secretarial
                                }
                                onChange={
                                    handleApproverChange
                                }
                                required
                            >

                                <option value="">
                                    Select Secretarial Approver
                                </option>

                                {approverOptions.SECRETARIAL.map((approver) => (
                                    <option key={approver.employeeId} value={approver.employeeId}>
                                        {approver.employeeName} - {approver.employeeId}
                                    </option>
                                ))}

                            </select>

                        </div>


                    </div>

                </section>


                <div className="form-actions">

                    <button
                        type="button"
                        className="cancel-button"
                        onClick={resetForm}
                    >

                        {editingId ? "Cancel Edit" : "Cancel"}

                    </button>


                    <button
                        type="submit"
                        className="submit-button"
                        disabled={submitting}
                    >

                        {submitting
                            ? "Submitting..."
                            : (editingId ? "Resubmit Request" : "Submit Request")}

                    </button>

                </div>


            </form>

        </div>

    );

}


export default Request;
