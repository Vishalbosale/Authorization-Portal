const requestService =
    require("../services/requestService");


const createRequest = async (req, res) => {

    try {

        const result =
            await requestService.createRequest(
                req.body,
                req.session.user
            );

        res.status(201).json({

            success: true,

            data: result

        });

    } catch (error) {

        console.error(error);

        res.status(error.status || 500).json({

            success: false,

            message:
                error.status ? error.message : "Unable to create request"

        });

    }

};


const getRequests = async (req, res) => {

    try {

        const result =
            await requestService.getRequests(
                req.session.user
            );

        res.json({

            success: true,

            data: result

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Unable to fetch requests"

        });

    }

};


const getRequestById = async (req, res) => {

    try {

        const result =
            await requestService
                .getRequestById(
                    req.params.id,
                    req.session.user
                );

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Request not found"
            });
        }

        res.json({

            success: true,

            data: result

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Unable to fetch request"

        });

    }

};


const takeAction = async (req, res) => {

    try {

        const { action, remark, extra } = req.body;

        const result =
            await requestService.takeAction(
                req.params.id,
                action,
                remark,
                extra,
                req.session.user
            );

        res.json({

            success: true,

            data: result

        });

    } catch (error) {

        console.error(error);

        res.status(error.status || 500).json({

            success: false,

            message:
                error.status ? error.message : "Unable to process action"

        });

    }

};


const resubmitRequest = async (req, res) => {

    try {

        const result =
            await requestService.resubmitRequest(
                req.params.id,
                req.body,
                req.session.user
            );

        res.json({

            success: true,

            data: result

        });

    } catch (error) {

        console.error(error);

        res.status(error.status || 500).json({

            success: false,

            message:
                error.status ? error.message : "Unable to resubmit request"

        });

    }

};


module.exports = {

    createRequest,

    getRequests,

    getRequestById,

    takeAction,

    resubmitRequest

};
