/**
 * The example match shipped with VolleyReportXLS (fictional players), used as
 * demo data in the app. Generated from src/oracle/volleyreportxls-oracle.json;
 * a test checks that the two stay identical.
 */

import type { Match } from '../domain/model';

export const SAMPLE_MATCH: Match = {
  "id": "esempio",
  "competition": "amichevole",
  "date": "2023-11-18",
  "venue": "Sanremo",
  "opponentName": "Rhythmic Blockers",
  "team": {
    "id": "team",
    "name": "Melodic Spikers",
    "players": [
      {
        "id": "slot-A",
        "number": 19,
        "name": "Elisa Toffoli"
      },
      {
        "id": "slot-B",
        "number": 1,
        "name": "Irene Grandi"
      },
      {
        "id": "slot-C",
        "number": 13,
        "name": "Giorgia Trodani"
      },
      {
        "id": "slot-D",
        "number": 10,
        "name": "Emma Marrone"
      },
      {
        "id": "slot-E",
        "number": 11,
        "name": "Lorendana Bertè",
        "role": "L"
      },
      {
        "id": "slot-F",
        "number": 9,
        "name": "Elodie Patrizi"
      },
      {
        "id": "slot-G",
        "number": 5,
        "name": "Laura Pausini"
      },
      {
        "id": "slot-H",
        "number": 18,
        "name": "Annalisa Scarrone"
      },
      {
        "id": "slot-I",
        "number": 22,
        "name": "Sara Sorrenti"
      },
      {
        "id": "slot-J",
        "number": 12,
        "name": "Veronica Scopelliti"
      },
      {
        "id": "slot-K",
        "number": 3,
        "name": "Alessandra Amoroso",
        "role": "L"
      },
      {
        "id": "slot-L",
        "number": 17,
        "name": "Carmen Consoli"
      },
      {
        "id": "slot-M",
        "number": 4,
        "name": "Gaia Gozzi"
      },
      {
        "id": "slot-N",
        "number": 6,
        "name": "Francesca Calearo"
      }
    ]
  },
  "sets": [
    {
      "number": 1,
      "score": {
        "team": 25,
        "opponent": 16
      },
      "lines": [
        {
          "id": "R2",
          "playerNumber": 19,
          "cells": [
            "B+",
            "B+",
            "B+",
            "A#",
            "B+",
            "B=",
            "R#",
            "R#",
            "R!",
            "A#"
          ]
        },
        {
          "id": "R3",
          "playerNumber": 5,
          "cells": [
            "M!",
            "M+",
            "B-",
            "M+",
            "M#",
            "B+",
            "B#",
            "B+",
            "B-"
          ]
        },
        {
          "id": "R4",
          "playerNumber": 17,
          "cells": [
            "A+",
            "A#",
            "A=",
            "A+",
            "R#",
            "A#",
            "B+",
            "B+",
            "B!"
          ]
        },
        {
          "id": "R5",
          "playerNumber": 1,
          "cells": [
            "A#",
            "M-",
            "B+",
            "A+",
            "A#",
            "A#",
            "P="
          ]
        },
        {
          "id": "R6",
          "playerNumber": 12,
          "cells": [
            "A#",
            "A+",
            "A=",
            "A#",
            "B+",
            "B+",
            "B=",
            "A#",
            "A#",
            "A#"
          ]
        },
        {
          "id": "R7",
          "playerNumber": 10,
          "cells": [
            "R-",
            "A#",
            "A=",
            "B#",
            "B#",
            "B+",
            "A-",
            "M!",
            "R#"
          ]
        },
        {
          "id": "R8",
          "playerNumber": 3,
          "cells": [
            "R-",
            "R#",
            "R!",
            "R!",
            "R+",
            "R="
          ]
        },
        {
          "id": "R9",
          "playerNumber": 4,
          "cells": [
            "B-",
            "B#",
            "B=",
            "B!",
            "A#",
            "A#",
            "M#"
          ]
        }
      ]
    },
    {
      "number": 2,
      "score": {
        "team": 25,
        "opponent": 18
      },
      "lines": [
        {
          "id": "R16",
          "playerNumber": 19,
          "cells": [
            "R/",
            "A!",
            "A+",
            "M!",
            "A#",
            "R-",
            "B-",
            "B/",
            "B-",
            "A+",
            "R#",
            "R#"
          ]
        },
        {
          "id": "R17",
          "playerNumber": 9,
          "cells": [
            "B+",
            "B=",
            "M+",
            "M#",
            "A+",
            "B+",
            "B#",
            "B#",
            "B#",
            "B="
          ]
        },
        {
          "id": "R18",
          "playerNumber": 5,
          "cells": [
            "A+",
            "B+",
            "B+",
            "B#",
            "B-",
            "M!",
            "M+",
            "M+",
            "M#",
            "B+",
            "B+",
            "B+"
          ]
        },
        {
          "id": "R19",
          "playerNumber": 17,
          "cells": [
            "R-",
            "A#",
            "A#",
            "A#",
            "A+",
            "R-",
            "B+",
            "B+",
            "B/",
            "A+",
            "A#",
            "A+",
            "R+",
            "A#",
            "A#"
          ]
        },
        {
          "id": "R20",
          "playerNumber": 1,
          "cells": [
            "M+",
            "M!",
            "A-",
            "A#",
            "M#"
          ]
        },
        {
          "id": "R21",
          "playerNumber": 22,
          "cells": [
            "A+",
            "M+",
            "A/",
            "M-",
            "A+",
            "A+",
            "A+",
            "A+",
            "M+",
            "A#",
            "B #",
            "B-",
            "B+",
            "A#",
            "A=",
            "A-",
            "A#"
          ]
        },
        {
          "id": "R22",
          "playerNumber": 3,
          "cells": [
            "R-",
            "R-",
            "R+",
            "R+",
            "R=",
            "R+",
            "R!",
            "R!",
            "R+"
          ]
        },
        {
          "id": "R23",
          "playerNumber": 4,
          "cells": [
            "B/",
            "R-",
            "R="
          ]
        }
      ]
    },
    {
      "number": 3,
      "score": {
        "team": 25,
        "opponent": 22
      },
      "lines": [
        {
          "id": "R30",
          "playerNumber": 19,
          "cells": [
            "B#",
            "B=",
            "A+",
            "A#",
            "B+",
            "B+",
            "M+",
            "A+",
            "A+",
            "M!",
            "B+",
            "A#",
            "R+",
            "R!",
            "R!"
          ]
        },
        {
          "id": "R31",
          "playerNumber": 5,
          "cells": [
            "M!",
            "B=",
            "M-",
            "M!",
            "B=",
            "M-",
            "M+",
            "B-",
            "A#"
          ]
        },
        {
          "id": "R32",
          "playerNumber": 6,
          "cells": [
            "A+",
            "R#",
            "A+",
            "B+",
            "B-",
            "A#",
            "A#",
            "A#",
            "A-",
            "A+",
            "A+",
            "A-",
            "B=",
            "R-",
            "R+",
            "A+",
            "A+",
            "A+",
            "B+",
            "B+",
            "B+",
            "R#"
          ]
        },
        {
          "id": "R33",
          "playerNumber": 9,
          "cells": [
            "A+",
            "A#",
            "B+",
            "B+",
            "B=",
            "B+",
            "B+"
          ]
        },
        {
          "id": "R34",
          "playerNumber": 22,
          "cells": [
            "A#",
            "A#",
            "A#",
            "B=",
            "A/",
            "A!",
            "A#",
            "A=",
            "A+",
            "B+",
            "A+",
            "B+",
            "A+"
          ]
        },
        {
          "id": "R35",
          "playerNumber": 4,
          "cells": [
            "R-",
            "R#",
            "R=",
            "R#",
            "R#",
            "B+",
            "A#",
            "R+",
            "A+",
            "B#",
            "B+",
            "R+",
            "R="
          ]
        },
        {
          "id": "R36",
          "playerNumber": 3,
          "cells": [
            "R#",
            "R-",
            "R+",
            "R+",
            "R#",
            "R#",
            "R+",
            "R/"
          ]
        },
        {
          "id": "R37",
          "playerNumber": 12,
          "cells": [
            "A+",
            "M+",
            "A+",
            "M+",
            "A=",
            "M="
          ]
        },
        {
          "id": "R38",
          "playerNumber": 17,
          "cells": [
            "A#",
            "A#",
            "A+",
            "A=",
            "A#"
          ]
        }
      ]
    },
    {
      "number": 4,
      "score": null,
      "lines": []
    },
    {
      "number": 5,
      "score": null,
      "lines": []
    }
  ]
};
