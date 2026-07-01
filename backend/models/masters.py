"""
Master data for the geography hierarchy: Country -> Location -> Outlet.

These are user-managed via the /api/masters endpoints so new outlets, cities
and countries can be added in the UI without any code change. Every uploaded
data record and every dashboard query is scoped to an outlet (or rolled up
across a selection), which is what makes the app multi-store / multi-country.
"""

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class Country(Base):
    __tablename__ = "countries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)      # "India"
    code = Column(String, nullable=True)                    # "IN"
    currency = Column(String, nullable=True)                # "INR"
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    locations = relationship(
        "Location", back_populates="country",
        cascade="all, delete-orphan", order_by="Location.name",
    )


class Location(Base):
    """A city / state / region within a country (e.g. 'Bengaluru')."""
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    country_id = Column(Integer, ForeignKey("countries.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    name = Column(String, nullable=False)                   # "Bengaluru"
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    country = relationship("Country", back_populates="locations")
    outlets = relationship(
        "Outlet", back_populates="location",
        cascade="all, delete-orphan", order_by="Outlet.name",
    )


class Outlet(Base):
    """A single store/outlet (e.g. 'Indiranagar', code 'BGL-IDN')."""
    __tablename__ = "outlets"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    code = Column(String, nullable=False, unique=True, index=True)  # "BGL-IDN"
    name = Column(String, nullable=False)                            # "Indiranagar"
    currency = Column(String, nullable=True)                         # falls back to country
    open_date = Column(String, nullable=True)                        # "2019-04" (optional)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    location = relationship("Location", back_populates="outlets")
