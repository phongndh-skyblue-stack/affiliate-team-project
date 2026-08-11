from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.affiliate_data.model import (
    AffiliateLink,
    AffiliateLinkProjectDataScan,
    AffiliateLinkTrafficScan,
)


class AffiliateDataRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_or_create_affiliate_link(
        self,
        user_id: str,
        affiliate_url: str,
        domain: str,
        name: str | None = None,
        search_query: str | None = None,
    ) -> AffiliateLink:
        stmt = select(AffiliateLink).where(
            AffiliateLink.user_id == user_id,
            AffiliateLink.affiliate_url == affiliate_url,
        )
        existing = self.db.scalar(stmt)
        if existing:
            if existing.domain != domain:
                existing.domain = domain
            if name is not None:
                existing.name = name
            if search_query is not None:
                existing.search_query = search_query
            return existing

        row = AffiliateLink(
            user_id=user_id,
            affiliate_url=affiliate_url,
            domain=domain,
            name=name,
            search_query=search_query,
            raw_data={"affiliate_url": affiliate_url, "domain": domain, "name": name, "search_query": search_query},
        )
        self.db.add(row)
        self.db.flush()
        return row

    def create_traffic_scan(
        self,
        affiliate_link_id: str,
        traffic_result: dict[str, Any],
    ) -> AffiliateLinkTrafficScan:
        row = AffiliateLinkTrafficScan(
            affiliate_link_id=affiliate_link_id,
            found=bool(traffic_result.get("found")),
            monthly_visits=int(traffic_result.get("monthly_visits") or 0),
            period_month=str(traffic_result.get("period_month") or ""),
            traffic_details=traffic_result.get("traffic_details"),
            raw_data=traffic_result,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def create_project_data_scan(
        self,
        affiliate_link_id: str,
        project_result: dict[str, Any],
    ) -> AffiliateLinkProjectDataScan:
        row = AffiliateLinkProjectDataScan(
            affiliate_link_id=affiliate_link_id,
            query=str(project_result.get("query") or ""),
            project_name=project_result.get("project_name"),
            project_link=project_result.get("project_link"),
            event_content=project_result.get("event_content"),
            sale_content=project_result.get("sale_content"),
            restricted_countries=project_result.get("restricted_countries") or [],
            top_countries=project_result.get("top_countries") or [],
            answer=project_result.get("answer"),
            results=project_result.get("results") or [],
            raw_data=project_result,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def commit(self) -> None:
        self.db.commit()

    def delete_traffic_scans_by_affiliate_link(self, affiliate_link_id: str) -> None:
        from sqlalchemy import delete
        stmt = delete(AffiliateLinkTrafficScan).where(
            AffiliateLinkTrafficScan.affiliate_link_id == affiliate_link_id
        )
        self.db.execute(stmt)
        self.db.flush()

    def delete_affiliate_link_for_user(
        self,
        user_id: str,
        affiliate_link_id: str,
    ) -> bool:
        row = self.get_affiliate_link_by_id_for_user(
            user_id=user_id,
            affiliate_link_id=affiliate_link_id,
        )
        if not row:
            return False
        self.db.delete(row)
        self.db.flush()
        return True

    def get_affiliate_link_by_id_for_user(
        self,
        user_id: str,
        affiliate_link_id: str,
    ) -> AffiliateLink | None:
        stmt = select(AffiliateLink).where(
            AffiliateLink.id == affiliate_link_id,
            AffiliateLink.user_id == user_id,
        )
        return self.db.scalar(stmt)

    def get_project_label_by_id_for_user(
        self,
        user_id: str,
        affiliate_link_id: str | None,
    ) -> tuple[str, str] | None:
        if not affiliate_link_id:
            return None
        row = self.get_affiliate_link_by_id_for_user(user_id, affiliate_link_id)
        if not row:
            return None
        return row.id, row.name or row.domain

    def get_all_affiliate_links_for_user(
        self,
        user_id: str,
    ) -> list[AffiliateLink]:
        stmt = (
            select(AffiliateLink)
            .where(AffiliateLink.user_id == user_id)
            .order_by(AffiliateLink.updated_at.desc())
        )
        return list(self.db.scalars(stmt))

    def get_affiliate_link_detail_by_user(
        self,
        user_id: str,
        affiliate_url: str,
    ) -> AffiliateLink | None:
        stmt = (
            select(AffiliateLink)
            .options(
                selectinload(AffiliateLink.traffic_scans),
                selectinload(AffiliateLink.project_data_scans),
            )
            .where(
                AffiliateLink.user_id == user_id,
                AffiliateLink.affiliate_url == affiliate_url,
            )
        )
        return self.db.scalar(stmt)
