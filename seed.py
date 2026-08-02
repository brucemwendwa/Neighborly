"""
Demo data.

    pipenv run python seed.py

Wipes every table and rebuilds a small but complete estate: two
communities, a catalogue, eight people, and enough bookings, payments,
listings, rides and gate passes that every screen in the client has
something real to render.

Every account uses the same password so the demo is easy to drive:

    admin@jiranihub.co.ke      admin
    amina@example.com          resident  (has bookings, a listing, a ride)
    brian@example.com          resident
    caleb@example.com          provider  (approved — plumbing, electrical)
    dorcas@example.com         provider  (approved — cleaning)
    esther@example.com         provider  (awaiting approval)
    gate@jiranihub.co.ke       security
    password:  Password123
"""

from datetime import timedelta
from decimal import Decimal

from main import create_app
from extensions import db
from models import (
    Booking,
    CommuteRide,
    Estate,
    GatePass,
    HouseListing,
    MoveRequest,
    Notification,
    Payment,
    Review,
    RideBooking,
    Service,
    ServiceCategory,
    ServiceProvider,
    User,
    UserWallet,
)
from models.base import utcnow

PASSWORD = "Password123"


def wipe():
    """Delete every row, children first so no foreign key is left dangling."""
    for model in (
        Review,
        Payment,
        GatePass,
        RideBooking,
        Booking,
        CommuteRide,
        MoveRequest,
        HouseListing,
        Notification,
        UserWallet,
        ServiceProvider,
        User,
        Service,
        ServiceCategory,
        Estate,
    ):
        db.session.query(model).delete()
    db.session.commit()


def make_user(full_name, email, phone, role, estate, bio=None, balance=0):
    user = User(
        full_name=full_name,
        email=email,
        phone=phone,
        role=role,
        estate_id=estate.estate_id if estate else None,
    )
    user.password = PASSWORD
    user.wallet = UserWallet(balance=Decimal(balance))
    if role == "provider":
        user.provider_profile = ServiceProvider(
            bio=bio, is_verified=True, is_approved=True
        )
    db.session.add(user)
    return user


def seed():
    now = utcnow()

    # --- Estates ---
    greenview = Estate(
        estate_name="Greenview Gardens",
        address="Kiambu Road, Runda",
        city="Nairobi",
        country="Kenya",
    )
    savannah = Estate(
        estate_name="Savannah Heights",
        address="Mombasa Road, Syokimau",
        city="Nairobi",
        country="Kenya",
    )
    db.session.add_all([greenview, savannah])
    db.session.flush()  # assigns the UUIDs we need below

    # --- Catalogue ---
    catalogue = {
        "Home Repair": (
            "Plumbing, electrical and general fixes",
            "wrench",
            [
                ("Plumbing", "Leaks, blockages, taps and cisterns", 1500),
                ("Electrical", "Sockets, lighting, fuse boards", 2000),
                ("Carpentry", "Doors, cabinets, shelving", 1800),
            ],
        ),
        "Cleaning": (
            "Homes, sofas and post-construction",
            "sparkle",
            [
                ("House Cleaning", "A full clean of a 1-3 bedroom home", 2500),
                ("Sofa & Carpet Cleaning", "Deep steam clean", 3000),
            ],
        ),
        "Moving": (
            "Trucks, loaders and packing",
            "truck",
            [("Moving Help", "Truck, loaders and packing materials", 8000)],
        ),
        "Security": (
            "Alarms, CCTV and gate hardware",
            "shield",
            [("CCTV Installation", "Cameras, wiring and setup", 12000)],
        ),
    }

    services = {}
    for name, (description, icon, items) in catalogue.items():
        category = ServiceCategory(name=name, description=description, icon=icon)
        db.session.add(category)
        db.session.flush()
        for service_name, service_desc, price in items:
            service = Service(
                name=service_name,
                description=service_desc,
                base_price=Decimal(price),
                category_id=category.category_id,
                icon=icon,
            )
            db.session.add(service)
            services[service_name] = service
    db.session.flush()

    # --- People ---
    admin = make_user(
        "Njeri Kamau", "admin@jiranihub.co.ke", "+254700000001", "admin", None
    )
    amina = make_user(
        "Amina Hassan", "amina@example.com", "+254700000002", "resident",
        greenview, balance=5000,
    )
    brian = make_user(
        "Brian Otieno", "brian@example.com", "+254700000003", "resident",
        greenview, balance=1200,
    )
    caleb = make_user(
        "Caleb Mwangi", "caleb@example.com", "+254700000004", "provider", greenview,
        bio="Licensed plumber and electrician. 9 years around Runda and Ruaka. "
        "Same-day callouts before 4pm.",
    )
    dorcas = make_user(
        "Dorcas Wanjiru", "dorcas@example.com", "+254700000005", "provider", greenview,
        bio="Home and sofa cleaning. I bring my own machine and supplies.",
    )
    esther = make_user(
        "Esther Njoki", "esther@example.com", "+254700000006", "provider", savannah,
        bio="Carpentry and fitted wardrobes. Newly joined.",
    )
    guard = make_user(
        "Peter Kilonzo", "gate@jiranihub.co.ke", "+254700000007", "security", greenview
    )
    faith = make_user(
        "Faith Chebet", "faith@example.com", "+254700000008", "resident", savannah,
        balance=800,
    )
    db.session.flush()

    # Esther is verified but not yet cleared to work — this is what the
    # admin approval queue in the client shows.
    esther.provider_profile.is_approved = False

    # --- Bookings, in a range of states so every status renders somewhere ---
    completed = Booking(
        user_id=amina.user_id,
        provider_id=caleb.provider_profile.provider_id,
        service_id=services["Plumbing"].service_id,
        estate_id=greenview.estate_id,
        booking_type="instant",
        status="completed",
        total_amount=Decimal(1500),
    )
    in_progress = Booking(
        user_id=brian.user_id,
        provider_id=dorcas.provider_profile.provider_id,
        service_id=services["House Cleaning"].service_id,
        estate_id=greenview.estate_id,
        booking_type="scheduled",
        status="in_progress",
        scheduled_date=now + timedelta(days=1),
        total_amount=Decimal(2500),
    )
    accepted = Booking(
        user_id=amina.user_id,
        provider_id=dorcas.provider_profile.provider_id,
        service_id=services["Sofa & Carpet Cleaning"].service_id,
        estate_id=greenview.estate_id,
        booking_type="scheduled",
        status="accepted",
        scheduled_date=now + timedelta(days=3),
        total_amount=Decimal(3000),
    )
    open_job = Booking(
        user_id=brian.user_id,
        service_id=services["Electrical"].service_id,
        estate_id=greenview.estate_id,
        booking_type="quotation",
        status="pending",
        total_amount=Decimal(2000),
    )
    db.session.add_all([completed, in_progress, accepted, open_job])
    db.session.flush()

    # --- Money ---
    db.session.add_all(
        [
            Payment(
                booking_id=completed.booking_id,
                user_id=amina.user_id,
                amount=Decimal(1500),
                payment_method="mpesa",
                status="success",
                transaction_ref="MPESA-SEED0001",
                paid_at=now - timedelta(days=6),
            ),
            Payment(
                booking_id=in_progress.booking_id,
                user_id=brian.user_id,
                amount=Decimal(1000),
                payment_method="wallet",
                status="success",
                transaction_ref="WALLET-SEED0002",
                paid_at=now - timedelta(days=1),
            ),
            Payment(
                booking_id=accepted.booking_id,
                user_id=amina.user_id,
                amount=Decimal(3000),
                payment_method="card",
                status="pending",
            ),
        ]
    )

    # --- Reviews (only on the completed booking — the API enforces that) ---
    db.session.add_all(
        [
            Review(
                booking_id=completed.booking_id,
                reviewer_id=amina.user_id,
                reviewee_id=caleb.user_id,
                rating=5,
                comment="Came within the hour and fixed the kitchen leak properly. "
                "Cleaned up after himself too.",
            ),
            Review(
                booking_id=completed.booking_id,
                reviewer_id=caleb.user_id,
                reviewee_id=amina.user_id,
                rating=5,
                comment="Clear directions and paid on the spot. Easy job.",
            ),
        ]
    )

    # --- Housing ---
    db.session.add_all(
        [
            HouseListing(
                user_id=amina.user_id,
                estate_id=greenview.estate_id,
                title="2 bedroom apartment, Block C",
                description="Second floor, borehole water, secure parking for one "
                "car. Available from the 1st.",
                rent_price=Decimal(45000),
                bedrooms=2,
                bathrooms=2,
                images=[
                    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
                    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
                ],
                status="vacant",
                is_verified=True,
            ),
            HouseListing(
                user_id=brian.user_id,
                estate_id=greenview.estate_id,
                title="Studio, ground floor",
                description="Compact studio with its own entrance. Water and "
                "garbage included in the rent.",
                rent_price=Decimal(22000),
                bedrooms=1,
                bathrooms=1,
                images=[
                    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"
                ],
                status="vacant",
                is_verified=False,
            ),
            HouseListing(
                user_id=faith.user_id,
                estate_id=savannah.estate_id,
                title="3 bedroom maisonette with SQ",
                description="Corner unit, own compound, DSQ at the back.",
                rent_price=Decimal(78000),
                bedrooms=3,
                bathrooms=3,
                images=[
                    "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"
                ],
                status="vacant",
                is_verified=True,
            ),
        ]
    )

    # --- Moving ---
    db.session.add(
        MoveRequest(
            user_id=brian.user_id,
            pickup_location="Greenview Gardens, Block C",
            dropoff_location="Kileleshwa, Laikipia Road",
            move_date=now + timedelta(days=9),
            service_type="all",
            status="pending",
            total_amount=Decimal(12000),
        )
    )

    # --- Commute ---
    morning = CommuteRide(
        driver_id=amina.user_id,
        estate_id=greenview.estate_id,
        from_location="Greenview Gardens",
        to_location="Westlands, Sarit Centre",
        departure_time=now + timedelta(days=1, hours=7),
        return_time=now + timedelta(days=1, hours=18),
        available_seats=3,
        price_per_seat=Decimal(250),
        recurrence="daily",
        status="active",
    )
    evening = CommuteRide(
        driver_id=caleb.user_id,
        estate_id=greenview.estate_id,
        from_location="Greenview Gardens",
        to_location="CBD, Kencom",
        departure_time=now + timedelta(days=2, hours=6),
        available_seats=2,
        price_per_seat=Decimal(300),
        recurrence="weekly",
        status="active",
    )
    db.session.add_all([morning, evening])
    db.session.flush()

    db.session.add(
        RideBooking(
            ride_id=morning.ride_id,
            passenger_id=brian.user_id,
            seats_booked=1,
            amount=Decimal(250),
            status="booked",
        )
    )

    # --- Gate passes ---
    db.session.add_all(
        [
            GatePass(
                user_id=amina.user_id,
                booking_id=accepted.booking_id,
                visitor_name="Dorcas Wanjiru",
                visitor_phone="+254700000005",
                purpose="Sofa cleaning appointment",
                entry_date=now + timedelta(days=3),
                exit_date=now + timedelta(days=3, hours=4),
                qr_code="GP-SEED0001",
                status="active",
            ),
            GatePass(
                user_id=brian.user_id,
                visitor_name="Mercy Adhiambo",
                visitor_phone="+254711222333",
                purpose="Family visit",
                entry_date=now + timedelta(hours=5),
                qr_code="GP-SEED0002",
                status="active",
            ),
        ]
    )

    # --- Notifications ---
    db.session.add_all(
        [
            Notification(
                user_id=amina.user_id,
                title="Booking completed",
                message="Caleb Mwangi finished your plumbing job. Leave a review "
                "to help your neighbours.",
                type="booking",
                is_read=True,
            ),
            Notification(
                user_id=amina.user_id,
                title="Payment received",
                message="KES 1500 paid for Plumbing.",
                type="payment",
            ),
            Notification(
                user_id=caleb.user_id,
                title="New 5-star review",
                message="Amina Hassan reviewed your work on Plumbing.",
                type="review",
            ),
            Notification(
                user_id=brian.user_id,
                title="Seat confirmed",
                message="You have 1 seat on the 7am ride to Westlands.",
                type="ride",
            ),
        ]
    )

    db.session.commit()

    print("Seeded:")
    print(f"  estates     {db.session.query(Estate).count()}")
    print(f"  users       {db.session.query(User).count()}")
    print(f"  categories  {db.session.query(ServiceCategory).count()}")
    print(f"  services    {db.session.query(Service).count()}")
    print(f"  bookings    {db.session.query(Booking).count()}")
    print(f"  payments    {db.session.query(Payment).count()}")
    print(f"  listings    {db.session.query(HouseListing).count()}")
    print(f"  rides       {db.session.query(CommuteRide).count()}")
    print(f"  gate passes {db.session.query(GatePass).count()}")
    print(f"\nSign in as any of the accounts above with password: {PASSWORD}")


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        wipe()
        seed()
