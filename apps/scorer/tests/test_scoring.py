import itertools

from app import config
from app.scoring import components, smile_score


def bs(mouth=0.0, eyes=0.0, jaw=0.0):
    return {
        "mouthSmileLeft": mouth,
        "mouthSmileRight": mouth,
        "cheekSquintLeft": eyes,
        "cheekSquintRight": eyes,
        "jawOpen": jaw,
    }


def test_all_zeros_scores_zero():
    assert smile_score(bs())[0] == 0


def test_all_ones_scores_hundred():
    assert smile_score(bs(1.0, 1.0, 1.0))[0] == 100


def test_gate_blocks_squint_and_yawn_alone():
    assert smile_score(bs(mouth=0.0, eyes=1.0, jaw=1.0))[0] == 0


def test_monotonic_in_mouth_smile():
    scores = [smile_score(bs(m / 20, 0.5, 0.5))[0] for m in range(21)]
    assert scores == sorted(scores)


def test_score_always_int_in_range():
    grid = [0.0, 0.25, 0.5, 0.75, 1.0]
    for m, e, j in itertools.product(grid, grid, grid):
        score, _ = smile_score(bs(m, e, j))
        assert isinstance(score, int)
        assert 0 <= score <= 100


def test_component_keys_and_values():
    got = components(
        {
            "mouthSmileLeft": 0.2,
            "mouthSmileRight": 0.4,
            "cheekSquintLeft": 0.1,
            "cheekSquintRight": 0.3,
            "jawOpen": 0.12345,
        }
    )
    assert got == {"mouth_smile": 0.3, "eye_crinkle": 0.2, "mouth_open": 0.1235}
    assert smile_score(bs(0.3, 0.2, 0.1))[1] == {
        "mouth_smile": 0.3,
        "eye_crinkle": 0.2,
        "mouth_open": 0.1,
    }


def test_missing_keys_default_to_zero():
    assert components({}) == {"mouth_smile": 0.0, "eye_crinkle": 0.0, "mouth_open": 0.0}
    assert smile_score({})[0] == 0


def test_model_version_ends_with_formula_version():
    assert config.MODEL_VERSION.endswith(config.FORMULA_VERSION)
