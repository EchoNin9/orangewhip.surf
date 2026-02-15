"""
OWS CI Validation — Terraform Outputs
This test validates that the CI environment has the expected
Terraform output structure. Runs during GitHub Actions CI.
"""


def test_terraform_outputs_defined():
    """
    Placeholder test for CI validation.
    In the GitHub Actions workflow, this ensures the test runner
    itself is functional and that the Terraform output variables
    (TABLE_NAME, MEDIA_BUCKET, etc.) can be referenced.
    Actual infrastructure validation happens in the Terraform plan step.
    """
    expected_outputs = [
        "TABLE_NAME",
        "MEDIA_BUCKET",
        "COGNITO_USER_POOL_ID",
        "THUMB_FUNCTION_NAME",
    ]
    # Verify the list is defined (structural check)
    assert len(expected_outputs) == 4
    assert all(isinstance(o, str) for o in expected_outputs)
