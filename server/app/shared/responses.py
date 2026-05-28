from typing import Any

from pydantic import BaseModel, ConfigDict

from app.shared.utils import snake_to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        alias_generator=snake_to_camel,
    )


class MessageResponse(CamelModel):
    message: str


def success_response(message: str, data: Any | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"message": message}
    if data is not None:
        payload["data"] = data
    return payload
