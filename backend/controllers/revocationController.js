const revocationService =
    require("../services/revocationService");


const getRevocations = async (req, res) => {

    try {

        const result =
            await revocationService.getRevocations(
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
                "Unable to fetch revocations"

        });

    }

};


const createRevocation = async (req, res) => {

    try {

        const { requestId, ...payload } = req.body;

        const result =
            await revocationService.createRevocation(
                requestId,
                payload,
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
                error.status ? error.message : "Unable to initiate revocation"

        });

    }

};


const takeAction = async (req, res) => {

    try {

        const { action, remark } = req.body;

        const result =
            await revocationService.takeAction(
                req.params.id,
                action,
                remark,
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
                error.status ? error.message : "Unable to process this revocation action"

        });

    }

};


module.exports = {

    getRevocations,

    createRevocation,

    takeAction

};
