"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getImageUrl as buildImageUrl, R2_PREFIX } from "@/lib/images";

type Property = {
  id: string;
  title: string;
  location: string;
  property_type: string;
  monthly_rent: number;
  bedrooms: number | null;
  description: string | null;
  status: string;
  rejection_reason?: string | null;
  created_at: string;
};

type PropertyImage = {
  id: string;
  property_id: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
};

type ViewingRequest = {
  id: string;
  property_id: string;
  tenant_id: string;
  message: string;
  status: string;
  created_at: string;
  propertyTitle?: string;
  propertyLocation?: string;
  tenantName?: string;
  tenantPhone?: string;
};

type SelectedPhoto = {
  id: string;
  file: File;
  preview: string;
};

type EditForm = {
  title: string;
  location: string;
  property_type: string;
  monthly_rent: string;
  bedrooms: string;
  description: string;
};

const MAX_PHOTOS = 6;
const MAX_FILE_SIZE = 12 * 1024 * 1024;

// Photos go to Cloudflare R2 first. If R2 is unavailable, the photo is saved
// in Supabase Storage instead, so landlords are never blocked.
// Set NEXT_PUBLIC_IMAGE_STORAGE=supabase in Vercel to skip R2 completely.
// Shrinks a photo before upload: max 1600 px on the longest side, JPEG.
// Makes uploads much faster on slow networks and saves storage space.
// If anything goes wrong, the original photo is uploaded instead.
async function compressPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );

    if (!blob || blob.size >= file.size) {
      return file;
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

const USE_R2_STORAGE = process.env.NEXT_PUBLIC_IMAGE_STORAGE !== "supabase";

const PROPERTY_TYPES = [
  "House",
  "Apartment",
  "Room",
  "Studio",
  "Commercial",
];

export default function LandlordPage() {
  // ============================================================
  // ACCOUNT
  // ============================================================

  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // ============================================================
  // DASHBOARD
  // ============================================================

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyImages, setPropertyImages] = useState<
    Record<string, PropertyImage[]>
  >({});
  const [requests, setRequests] = useState<ViewingRequest[]>([]);

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const [activeSection, setActiveSection] = useState<
    "dashboard" | "properties" | "requests" | "add"
  >("dashboard");

  const [propertyFilter, setPropertyFilter] = useState("All");
  const [propertySearch, setPropertySearch] = useState("");

  // ============================================================
  // VIEWING REQUEST FILTERS
  // ============================================================

  const [requestFilter, setRequestFilter] = useState<
    "All" | "Pending" | "Accepted" | "Rejected"
  >("All");

  const [requestSearch, setRequestSearch] = useState("");

  // ============================================================
  // PROPERTY FORM
  // ============================================================

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("House");
  const [rent, setRent] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [description, setDescription] = useState("");

  const [selectedPhotos, setSelectedPhotos] = useState<
    SelectedPhoto[]
  >([]);

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ============================================================
  // EDIT PROPERTY
  // ============================================================

  const [editingProperty, setEditingProperty] =
    useState<Property | null>(null);

  const [editForm, setEditForm] = useState<EditForm>({
    title: "",
    location: "",
    property_type: "House",
    monthly_rent: "",
    bedrooms: "",
    description: "",
  });

  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  // ============================================================
  // ADD PHOTOS TO EXISTING PROPERTY
  // ============================================================

  const [photoProperty, setPhotoProperty] =
    useState<Property | null>(null);

  const [additionalPhotos, setAdditionalPhotos] = useState<
    SelectedPhoto[]
  >([]);

  const [additionalPhotoError, setAdditionalPhotoError] =
    useState("");

  const [uploadingAdditionalPhotos, setUploadingAdditionalPhotos] =
    useState(false);

  // ============================================================
  // PHOTO VIEWER
  // ============================================================

  const [galleryProperty, setGalleryProperty] =
    useState<Property | null>(null);

  const [galleryIndex, setGalleryIndex] = useState(0);

  // ============================================================
  // REQUEST ACTIONS
  // ============================================================

  const [updatingRequest, setUpdatingRequest] =
    useState<string | null>(null);

  // ============================================================
  // GENERAL ACTION FEEDBACK
  // ============================================================

  const [actionMessage, setActionMessage] = useState("");

  // ============================================================
  // IMAGE URL
  // ============================================================

  function getImageUrl(storagePath: string) {
    return buildImageUrl(storagePath);
  }

  // ============================================================
  // STATUS HELPERS
  // ============================================================

  function statusStyle(status: string) {
    if (status === "Approved") {
      return {
        background: "#DCFCE7",
        color: "#166534",
        border: "1px solid #BBF7D0",
      };
    }

    if (status === "Rejected" || status === "Declined") {
      return {
        background: "#FEE2E2",
        color: "#991B1B",
        border: "1px solid #FECACA",
      };
    }

    return {
      background: "#FEF3C7",
      color: "#92400E",
      border: "1px solid #FDE68A",
    };
  }

  function requestStatusStyle(status: string) {
    if (status === "Accepted") {
      return {
        background: "#DCFCE7",
        color: "#166534",
        border: "1px solid #BBF7D0",
      };
    }

    if (status === "Rejected") {
      return {
        background: "#FEE2E2",
        color: "#991B1B",
        border: "1px solid #FECACA",
      };
    }

    return {
      background: "#FEF3C7",
      color: "#92400E",
      border: "1px solid #FDE68A",
    };
  }

  // ============================================================
  // LOAD PROPERTY IMAGES
  // ============================================================

  async function loadPropertyImages(propertyList: Property[]) {
    if (!propertyList.length) {
      setPropertyImages({});
      return;
    }

    const propertyIds = propertyList.map(
      (property) => property.id
    );

    const { data, error } = await supabase
      .from("property_images")
      .select(
        "id, property_id, storage_path, caption, sort_order, created_at"
      )
      .in("property_id", propertyIds)
      .order("sort_order", {
        ascending: true,
      });

    if (error) {
      console.error("Property images loading error:", error);
      return;
    }

    const grouped: Record<string, PropertyImage[]> = {};

    for (const image of data || []) {
      if (!grouped[image.property_id]) {
        grouped[image.property_id] = [];
      }

      grouped[image.property_id].push(image);
    }

    setPropertyImages(grouped);
  }

  // ============================================================
  // LOAD VIEWING REQUESTS
  // ============================================================

  const loadViewingRequests = async (loadedProperties: Property[]) => {
    try {
      if (!loadedProperties.length) {
        setRequests([]);
        return;
      }
  
      const propertyIds = loadedProperties.map((property) => property.id);
  
      const { data: requestData, error: requestError } = await supabase
        .from("viewing_requests")
        .select("*")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false });
  
      if (requestError) {
        throw requestError;
      }
  
      if (!requestData || requestData.length === 0) {
        setRequests([]);
        return;
      }
  
      const tenantIds = Array.from(new Set(
          requestData
            .map((request) => request.tenant_id)
            .filter(Boolean)
        ));
  
      let tenantProfiles: Record<
        string,
        { full_name: string; phone: string }
      > = {};
  
      if (tenantIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", tenantIds);
  
        if (profilesError) {
          console.error("Could not load tenant profiles:", profilesError);
        } else if (profilesData) {
          tenantProfiles = profilesData.reduce(
            (acc, profile) => {
              acc[profile.id] = {
                full_name: profile.full_name || "Tenant",
                phone: profile.phone || "Phone not available",
              };
              return acc;
            },
            {} as Record<string, { full_name: string; phone: string }>
          );
        }
      }
  
      const formattedRequests: ViewingRequest[] = requestData.map(
        (request) => {
          const property = loadedProperties.find(
            (item) => item.id === request.property_id
          );
  
          const tenant = tenantProfiles[request.tenant_id];
  
          return {
            id: request.id,
            property_id: request.property_id,
            tenant_id: request.tenant_id,
            message: request.message || "",
            status: request.status || "Pending",
            created_at: request.created_at,
  
            propertyTitle: property?.title || "Unknown Property",
            propertyLocation: property?.location || "Location unavailable",
  
            tenantName: tenant?.full_name || "Tenant",
            tenantPhone: tenant?.phone || "Phone not available",
          };
        }
      );
  
      setRequests(formattedRequests);
    } catch (error: any) {
      console.error("Error loading viewing requests:", error);
      setRequests([]);
    }
  };
  
  
  // ============================================================
  // LOAD COMPLETE DASHBOARD
  // ============================================================

  async function loadLandlordDashboard() {
    setLoadingDashboard(true);
    setDashboardError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setDashboardError(
          "Please log in as a landlord to view your dashboard."
        );

        setLoadingDashboard(false);
        return;
      }

      setUserId(user.id);

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role, full_name, phone")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile error:", profileError);

        setDashboardError(
          "We could not verify your landlord account."
        );

        setLoadingDashboard(false);
        return;
      }

      if (!profile || profile.role !== "landlord") {
        setDashboardError(
          "This account is not registered as a landlord."
        );

        setLoadingDashboard(false);
        return;
      }

      setName(profile.full_name || "");
      setPhone(profile.phone || "");

      const {
        data: landlordProperties,
        error: propertiesError,
      } = await supabase
        .from("properties")
        .select(
          "id, title, location, property_type, monthly_rent, bedrooms, description, status, rejection_reason, created_at"
        )
        .eq("landlord_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (propertiesError) {
        console.error(
          "Properties loading error:",
          propertiesError
        );

        setDashboardError(
          "We could not load your properties."
        );

        setLoadingDashboard(false);
        return;
      }

      const loadedProperties = landlordProperties || [];

      setProperties(loadedProperties);

      await loadPropertyImages(loadedProperties);
      await loadViewingRequests(loadedProperties);
    } catch (err) {
      console.error("Dashboard error:", err);

      setDashboardError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading your dashboard."
      );
    }

    setLoadingDashboard(false);
  }

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadLandlordDashboard();
  }, []);

  // ============================================================
  // DASHBOARD STATISTICS
  // ============================================================

  const totalProperties = properties.length;

  const approvedProperties = properties.filter(
    (property) => property.status === "Approved"
  ).length;

  const pendingProperties = properties.filter(
    (property) =>
      property.status === "Pending Verification"
  ).length;

  const rejectedProperties = properties.filter(
    (property) =>
      property.status === "Rejected" ||
      property.status === "Declined"
  ).length;

  const pendingRequests = requests.filter(
    (request) => request.status === "Pending"
  ).length;

  const acceptedRequests = requests.filter(
    (request) => request.status === "Accepted"
  ).length;

  const rejectedRequests = requests.filter(
    (request) => request.status === "Rejected"
  ).length;

  // ============================================================
  // FILTERED PROPERTIES
  // ============================================================

  const filteredProperties = useMemo(() => {
    const search = propertySearch.trim().toLowerCase();

    return properties.filter((property) => {
      const matchesFilter =
        propertyFilter === "All" ||
        property.status === propertyFilter;

      const matchesSearch =
        !search ||
        property.title.toLowerCase().includes(search) ||
        property.location.toLowerCase().includes(search) ||
        property.property_type
          .toLowerCase()
          .includes(search);

      return matchesFilter && matchesSearch;
    });
  }, [
    properties,
    propertyFilter,
    propertySearch,
  ]);

  // ============================================================
  // FILTERED VIEWING REQUESTS
  // ============================================================

  const filteredRequests = useMemo(() => {
    const search = requestSearch.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus =
        requestFilter === "All" ||
        request.status === requestFilter;

      const matchesSearch =
        !search ||
        (request.propertyTitle || "")
          .toLowerCase()
          .includes(search) ||
        (request.propertyLocation || "")
          .toLowerCase()
          .includes(search) ||
        (request.tenantName || "")
          .toLowerCase()
          .includes(search) ||
        (request.tenantPhone || "")
          .toLowerCase()
          .includes(search) ||
        (request.message || "")
          .toLowerCase()
          .includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [
    requests,
    requestFilter,
    requestSearch,
  ]);

  // ============================================================
  // PHOTO SELECTION FOR NEW PROPERTY
  // ============================================================

  function handlePhotoSelection(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    setPhotoError("");

    const files = Array.from(
      event.target.files || []
    );

    if (!files.length) {
      return;
    }

    const availableSlots =
      MAX_PHOTOS - selectedPhotos.length;

    if (availableSlots <= 0) {
      setPhotoError(
        `You can upload a maximum of ${MAX_PHOTOS} photos.`
      );

      event.target.value = "";
      return;
    }

    const filesToProcess =
      files.slice(0, availableSlots);

    const validPhotos: SelectedPhoto[] = [];

    for (const file of filesToProcess) {
      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
        ].includes(file.type)
      ) {
        setPhotoError(
          "Only JPG, PNG or WEBP images are allowed."
        );
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setPhotoError(
          `${file.name} is larger than 12 MB. Please choose a smaller image.`
        );
        continue;
      }

      validPhotos.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      });
    }

    if (files.length > availableSlots) {
      setPhotoError(
        `Only ${availableSlots} more photo${
          availableSlots === 1 ? "" : "s"
        } can be added. Maximum is ${MAX_PHOTOS}.`
      );
    }

    setSelectedPhotos((previous) => [
      ...previous,
      ...validPhotos,
    ]);

    event.target.value = "";
  }

  // ============================================================
  // ADDITIONAL PHOTO SELECTION
  // ============================================================

  function handleAdditionalPhotoSelection(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    setAdditionalPhotoError("");

    const files = Array.from(
      event.target.files || []
    );

    if (!files.length) {
      return;
    }

    if (!photoProperty) {
      event.target.value = "";
      return;
    }

    const existingCount =
      propertyImages[photoProperty.id]?.length || 0;

    const availableSlots =
      MAX_PHOTOS -
      existingCount -
      additionalPhotos.length;

    if (availableSlots <= 0) {
      setAdditionalPhotoError(
        `This property already has the maximum of ${MAX_PHOTOS} photos.`
      );

      event.target.value = "";
      return;
    }

    const filesToProcess =
      files.slice(0, availableSlots);

    const validPhotos: SelectedPhoto[] = [];

    for (const file of filesToProcess) {
      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
        ].includes(file.type)
      ) {
        setAdditionalPhotoError(
          "Only JPG, PNG or WEBP images are allowed."
        );
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setAdditionalPhotoError(
          `${file.name} is larger than 12 MB.`
        );
        continue;
      }

      validPhotos.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      });
    }

    if (files.length > availableSlots) {
      setAdditionalPhotoError(
        `Only ${availableSlots} more photo${
          availableSlots === 1 ? "" : "s"
        } can be added.`
      );
    }

    setAdditionalPhotos((previous) => [
      ...previous,
      ...validPhotos,
    ]);

    event.target.value = "";
  }

  // ============================================================
  // REMOVE SELECTED NEW PHOTO
  // ============================================================

  function removeSelectedPhoto(id: string) {
    setSelectedPhotos((previous) => {
      const photo = previous.find(
        (item) => item.id === id
      );

      if (photo) {
        URL.revokeObjectURL(photo.preview);
      }

      return previous.filter(
        (item) => item.id !== id
      );
    });
  }

  // ============================================================
  // REMOVE ADDITIONAL PHOTO
  // ============================================================

  function removeAdditionalPhoto(id: string) {
    setAdditionalPhotos((previous) => {
      const photo = previous.find(
        (item) => item.id === id
      );

      if (photo) {
        URL.revokeObjectURL(photo.preview);
      }

      return previous.filter(
        (item) => item.id !== id
      );
    });
  }

  // ============================================================
  // PHOTO STORAGE HELPERS (Cloudflare R2 + older Supabase photos)
  // ============================================================

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "Your session has expired. Please log in again."
      );
    }

    return session.access_token;
  }

  async function deleteStoredPhotos(paths: string[]) {
    const r2Paths = paths.filter((path) =>
      path.startsWith(R2_PREFIX)
    );
    const oldPaths = paths.filter(
      (path) => !path.startsWith(R2_PREFIX)
    );

    if (r2Paths.length > 0) {
      const accessToken = await getAccessToken();

      const response = await fetch("/api/images/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ storagePaths: r2Paths }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || "Could not remove the photo file."
        );
      }
    }

    if (oldPaths.length > 0) {
      const { error } = await supabase.storage
        .from("property-images")
        .remove(oldPaths);

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  // ============================================================
  // UPLOAD PROPERTY PHOTOS
  // ============================================================

  async function uploadPropertyPhotos(
    propertyId: string,
    photos: SelectedPhoto[],
    startingSortOrder = 0
  ) {
    if (!photos.length) {
      return {
        success: true,
        uploadedCount: 0,
      };
    }

    const uploadedStoragePaths: string[] = [];

    const uploadedRows: {
      property_id: string;
      storage_path: string;
      caption: string | null;
      sort_order: number;
    }[] = [];

    try {
      for (
        let index = 0;
        index < photos.length;
        index++
      ) {
        const originalPhoto = photos[index];

        const photo = {
          ...originalPhoto,
          file: await compressPhoto(originalPhoto.file),
        };

        let storagePath = "";
        let storedInR2 = false;

        if (USE_R2_STORAGE) {
          try {
            const accessToken = await getAccessToken();

            // 1. Ask our server for a short-lived upload link
            const linkResponse = await fetch("/api/images/upload-url", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                propertyId,
                contentType: photo.file.type,
                size: photo.file.size,
              }),
            });

            const linkData = await linkResponse.json();

            if (!linkResponse.ok) {
              throw new Error(
                linkData.error || "Could not prepare the photo upload."
              );
            }

            storagePath = linkData.storagePath;

            // 2. Send the photo straight to Cloudflare
            const uploadResponse = await fetch(linkData.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": photo.file.type },
              body: photo.file,
            });

            if (!uploadResponse.ok) {
              console.error("Photo upload error:", uploadResponse.status);

              throw new Error(
                "The photo could not be uploaded. Please try again."
              );
            }

            storedInR2 = true;
          } catch (r2Error) {
            console.warn(
              "Cloudflare upload failed, using Supabase instead:",
              r2Error
            );
            storagePath = "";
          }
        }

        if (!storedInR2) {
          const originalExtension =
            photo.file.name.split(".").pop()?.toLowerCase() || "jpg";

          const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(
            originalExtension
          )
            ? originalExtension
            : "jpg";

          const fileName = `${crypto.randomUUID()}.${safeExtension}`;

          storagePath = `${propertyId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("property-images")
            .upload(storagePath, photo.file, {
              cacheControl: "3600",
              upsert: false,
              contentType: photo.file.type,
            });

          if (uploadError) {
            console.error("Photo upload error:", uploadError);

            throw new Error(uploadError.message);
          }
        }

        uploadedStoragePaths.push(
          storagePath
        );

        uploadedRows.push({
          property_id: propertyId,
          storage_path: storagePath,
          caption: null,
          sort_order:
            startingSortOrder + index,
        });
      }

      if (uploadedRows.length > 0) {
        const {
          error: imageInsertError,
        } = await supabase
          .from("property_images")
          .insert(uploadedRows);

        if (imageInsertError) {
          console.error(
            "Property image database error:",
            imageInsertError
          );

          throw new Error(
            imageInsertError.message
          );
        }
      }

      return {
        success: true,
        uploadedCount: uploadedRows.length,
      };
    } catch (err) {
      console.error(
        "Unexpected photo upload error:",
        err
      );

      if (uploadedStoragePaths.length > 0) {
        try {
          await deleteStoredPhotos(uploadedStoragePaths);
        } catch (cleanupError) {
          console.error(
            "Storage cleanup error:",
            cleanupError
          );
        }
      }

      return {
        success: false,
        uploadedCount: 0,
        error:
          err instanceof Error
            ? err.message
            : "Photo upload failed.",
      };
    }
  }

  // ============================================================
  // SUBMIT NEW PROPERTY
  // ============================================================

  async function submitProperty(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setPhotoError("");

    if (submitting) {
      return;
    }

    if (
      !title.trim() ||
      !location.trim() ||
      !rent ||
      Number(rent) <= 0
    ) {
      setError(
        "Complete all required property fields and enter a valid monthly rent."
      );
      return;
    }

    if (phone.trim().length !== 10) {
      setError(
        "Please enter a valid 10-digit phone number."
      );
      return;
    }

    if (bedrooms.trim()) {
      const bedroomNumber = Number(
        bedrooms
      );

      if (
        !Number.isInteger(
          bedroomNumber
        ) ||
        bedroomNumber < 0
      ) {
        setError(
          "Number of bedrooms must be a valid whole number."
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError(
          "Your session has expired. Please log in again."
        );
        setSubmitting(false);
        return;
      }

      const {
        data: newProperty,
        error: insertError,
      } = await supabase
        .from("properties")
        .insert({
          landlord_id: user.id,
          title: title.trim(),
          location: location.trim(),
          property_type: type,
          monthly_rent: Number(rent),
          bedrooms: bedrooms.trim()
            ? Number(bedrooms)
            : null,
          description:
            description.trim() || null,
          status:
            "Pending Verification",
        })
        .select(
          "id, title, location, property_type, monthly_rent, bedrooms, description, status, rejection_reason, created_at"
        )
        .single();

      if (
        insertError ||
        !newProperty
      ) {
        console.error(
          "Property submission error:",
          insertError
        );

        setError(
          "We could not save your property. " +
            (insertError?.message ||
              "Please try again.")
        );

        setSubmitting(false);
        return;
      }

      if (selectedPhotos.length > 0) {
        const photoResult =
          await uploadPropertyPhotos(
            newProperty.id,
            selectedPhotos
          );

        if (!photoResult.success) {
          setError(
            `Your property was saved, but the photos could not be uploaded. ${photoResult.error || ""}`
          );
        }
      }

      selectedPhotos.forEach(
        (photo) =>
          URL.revokeObjectURL(
            photo.preview
          )
      );

      setSelectedPhotos([]);

      setSubmitted(true);

      await loadLandlordDashboard();
    } catch (err) {
      console.error(
        "Unexpected submission error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
    }

    setSubmitting(false);
  }

  // ============================================================
  // OPEN EDIT PROPERTY
  // ============================================================

  function openEditProperty(property: Property) {
    setEditingProperty(property);

    setEditForm({
      title: property.title || "",
      location: property.location || "",
      property_type:
        property.property_type || "House",
      monthly_rent:
        property.monthly_rent !== null &&
        property.monthly_rent !== undefined
          ? String(property.monthly_rent)
          : "",
      bedrooms:
        property.bedrooms !== null &&
        property.bedrooms !== undefined
          ? String(property.bedrooms)
          : "",
      description:
        property.description || "",
    });

    setEditError("");
    setEditSuccess("");
  }

  // ============================================================
  // SAVE EDITED PROPERTY
  // ============================================================

  async function saveEditedProperty(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingProperty || savingEdit) {
      return;
    }

    setEditError("");
    setEditSuccess("");
    setSavingEdit(true);

    try {
      const cleanTitle =
        editForm.title.trim();

      const cleanLocation =
        editForm.location.trim();

      const cleanDescription =
        editForm.description.trim() || null;

      const monthlyRent = Number(
        editForm.monthly_rent
      );

      const bedroomNumber =
        editForm.bedrooms.trim() === ""
          ? null
          : Number(editForm.bedrooms);

      if (!cleanTitle || !cleanLocation) {
        setEditError(
          "Property title and location are required."
        );
        return;
      }

      if (
        !Number.isFinite(monthlyRent) ||
        monthlyRent <= 0
      ) {
        setEditError(
          "Please enter a valid monthly rent."
        );
        return;
      }

      if (
        bedroomNumber !== null &&
        (!Number.isInteger(bedroomNumber) ||
          bedroomNumber < 0)
      ) {
        setEditError(
          "Bedrooms must be a valid whole number."
        );
        return;
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(
          `Authentication error: ${authError.message}`
        );
      }

      if (!user) {
        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      const { error: updateError } =
        await supabase
          .from("properties")
          .update({
            title: cleanTitle,
            location: cleanLocation,
            property_type:
              editForm.property_type,
            monthly_rent: monthlyRent,
            bedrooms: bedroomNumber,
            description: cleanDescription,
            status: "Pending Verification",
            rejection_reason: null,
          })
          .eq("id", editingProperty.id)
          .eq("landlord_id", user.id);

      if (updateError) {
        console.error(
          "Property update error:",
          updateError
        );

        throw new Error(
          `Property update failed: ${updateError.message}`
        );
      }

      setEditSuccess(
        "Property updated successfully and sent for verification."
      );

      await loadLandlordDashboard();

      setTimeout(() => {
        setEditingProperty(null);
        setEditSuccess("");
      }, 1200);
    } catch (err) {
      console.error(
        "Unexpected property edit error:",
        err
      );

      setEditError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while updating the property."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  // ============================================================
  // OPEN PHOTO MANAGEMENT
  // ============================================================

  function openPhotoManager(
    property: Property
  ) {
    setPhotoProperty(property);
    setAdditionalPhotos([]);
    setAdditionalPhotoError("");
  }

  // ============================================================
  // UPLOAD ADDITIONAL PHOTOS
  // ============================================================

  async function uploadAdditionalPhotos() {
    if (
      !photoProperty ||
      additionalPhotos.length === 0 ||
      uploadingAdditionalPhotos
    ) {
      return;
    }

    const existingImages =
      propertyImages[
        photoProperty.id
      ] || [];

    if (
      existingImages.length +
        additionalPhotos.length >
      MAX_PHOTOS
    ) {
      setAdditionalPhotoError(
        `A property can have a maximum of ${MAX_PHOTOS} photos.`
      );
      return;
    }

    setUploadingAdditionalPhotos(
      true
    );
    setAdditionalPhotoError("");

    const result =
      await uploadPropertyPhotos(
        photoProperty.id,
        additionalPhotos,
        existingImages.length
      );

    if (!result.success) {
      setAdditionalPhotoError(
        result.error ||
          "Could not upload the photos."
      );

      setUploadingAdditionalPhotos(
        false
      );
      return;
    }

    additionalPhotos.forEach(
      (photo) =>
        URL.revokeObjectURL(
          photo.preview
        )
    );

    setAdditionalPhotos([]);

    await loadPropertyImages(
      properties
    );

    setActionMessage(
      "Photos added successfully."
    );

    setUploadingAdditionalPhotos(
      false
    );
  }

  // ============================================================
  // DELETE EXISTING PHOTO
  // ============================================================

  async function deletePropertyPhoto(
    image: PropertyImage
  ) {
    const confirmed = window.confirm(
      "Remove this property photo? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setActionMessage("");

    try {
      let storageError: unknown = null;

      try {
        await deleteStoredPhotos([image.storage_path]);
      } catch (deleteError) {
        storageError = deleteError;
      }

      if (storageError) {
        console.error(
          "Photo storage deletion error:",
          storageError
        );

        setActionMessage(
          "We could not remove the photo. Please try again."
        );
        return;
      }

      const { error: databaseError } =
        await supabase
          .from("property_images")
          .delete()
          .eq("id", image.id);

      if (databaseError) {
        console.error(
          "Photo database deletion error:",
          databaseError
        );

        setActionMessage(
          "The photo file was removed, but its database record could not be removed. Please contact support."
        );
        return;
      }

      await loadPropertyImages(
        properties
      );

      setActionMessage(
        "Photo removed successfully."
      );
    } catch (err) {
      console.error(
        "Unexpected photo deletion error:",
        err
      );

      setActionMessage(
        "An unexpected error occurred while removing the photo."
      );
    }
  }

  // ============================================================
  // OPEN GALLERY
  // ============================================================

  function openGallery(
    property: Property,
    index = 0
  ) {
    const images =
      propertyImages[
        property.id
      ] || [];

    if (!images.length) {
      return;
    }

    setGalleryProperty(property);
    setGalleryIndex(index);
  }

  // ============================================================
  // ACCEPT / REJECT VIEWING REQUEST
  // ============================================================

  async function updateRequestStatus(
    requestId: string,
    newStatus:
      | "Accepted"
      | "Rejected"
  ) {
    if (updatingRequest) {
      return;
    }

    const request = requests.find(
      (item) => item.id === requestId
    );

    if (!request) {
      setDashboardError(
        "This viewing request could not be found."
      );
      return;
    }

    const actionText =
      newStatus === "Accepted"
        ? "accept"
        : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} this viewing request from ${
        request.tenantName ||
        "this tenant"
      }?`
    );

    if (!confirmed) {
      return;
    }

    setUpdatingRequest(requestId);
    setDashboardError("");
    setActionMessage("");

    try {
      const { error: updateError } =
        await supabase
          .from("viewing_requests")
          .update({
            status: newStatus,
          })
          .eq("id", requestId);

      if (updateError) {
        console.error(
          "Viewing request update error:",
          updateError
        );

        setDashboardError(
          `We could not ${actionText} this request. ${updateError.message}`
        );

        setUpdatingRequest(null);
        return;
      }

      await loadLandlordDashboard();

      setActionMessage(
        newStatus === "Accepted"
          ? "Viewing request accepted successfully. The tenant can now see your response."
          : "Viewing request rejected successfully. The tenant can now see your response."
      );
    } catch (err) {
      console.error(
        "Unexpected request update error:",
        err
      );

      setDashboardError(
        "An unexpected error occurred while updating the request."
      );
    }

    setUpdatingRequest(null);
  }

  // ============================================================
  // REFRESH DASHBOARD
  // ============================================================

  async function refreshDashboard() {
    setActionMessage("");
    setDashboardError("");

    await loadLandlordDashboard();

    setActionMessage(
      "Dashboard refreshed successfully."
    );
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async function handleLogout() {
    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      setDashboardError(
        "Could not log you out. Please try again."
      );
      return;
    }

    window.location.href = "/landlord";
  }

  // ============================================================
  // RESET NEW PROPERTY FORM
  // ============================================================

  function resetNewPropertyForm() {
    selectedPhotos.forEach(
      (photo) =>
        URL.revokeObjectURL(
          photo.preview
        )
    );

    setSelectedPhotos([]);
    setTitle("");
    setLocation("");
    setRent("");
    setBedrooms("");
    setDescription("");
    setType("House");
    setError("");
    setPhotoError("");
    setSubmitted(false);
  }

  // ============================================================
  // STYLES
  // ============================================================

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#F4F7FB",
    fontFamily:
      "Arial, Helvetica, sans-serif",
    color: "#102A43",
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "0 18px",
  };

  const cardStyle: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #D9E2EC",
    borderRadius: "16px",
    boxShadow:
      "0 4px 15px rgba(16, 42, 67, 0.05)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 14px",
    border: "1px solid #CBD5E1",
    borderRadius: "9px",
    fontSize: "15px",
    boxSizing: "border-box",
    marginTop: "7px",
    marginBottom: "18px",
    background: "#FFFFFF",
    color: "#102A43",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: "bold",
    fontSize: "14px",
    color: "#334E68",
  };

  const primaryButton: React.CSSProperties = {
    background: "#0B3B75",
    color: "white",
    border: "none",
    borderRadius: "9px",
    padding: "12px 17px",
    fontWeight: "bold",
    cursor: "pointer",
  };

  const secondaryButton: React.CSSProperties = {
    background: "#EEF4FA",
    color: "#0B3B75",
    border: "1px solid #CBD5E1",
    borderRadius: "9px",
    padding: "11px 15px",
    fontWeight: "bold",
    cursor: "pointer",
  };

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main style={pageStyle}>
      {/* ======================================================
          HEADER
      ====================================================== */}

      <header
        style={{
          background: "#0B3B75",
          color: "white",
          position: "sticky",
          top: 0,
          zIndex: 30,
          boxShadow:
            "0 2px 12px rgba(0,0,0,0.15)",
        }}
      >
        <div
          style={{
            ...containerStyle,
            paddingTop: "15px",
            paddingBottom: "15px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "21px",
                fontWeight: "bold",
              }}
            >
              🏠 HOUSE CONNECT
            </div>

            <div
              style={{
                fontSize: "11px",
                opacity: 0.8,
                marginTop: "3px",
                letterSpacing:
                  "1px",
              }}
            >
              LANDLORD PORTAL
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/"
              style={{
                color: "white",
                textDecoration:
                  "none",
                padding:
                  "9px 13px",
                borderRadius: "8px",
                background:
                  "rgba(255,255,255,0.1)",
              }}
            >
              Home
            </Link>

            {userId ? (
              <button
                type="button"
                onClick={
                  handleLogout
                }
                style={{
                  padding:
                    "9px 13px",
                  borderRadius: "8px",
                  border:
                    "1px solid rgba(255,255,255,0.35)",
                  background:
                    "transparent",
                  color: "white",
                  fontWeight:
                    "bold",
                  cursor:
                    "pointer",
                }}
              >
                Logout
              </button>
            ) : (
              <Link
                href="/auth?mode=login"
                style={{
                  padding:
                    "9px 16px",
                  borderRadius: "8px",
                  background:
                    "white",
                  color: "#0B3B75",
                  fontWeight:
                    "bold",
                  textDecoration:
                    "none",
                }}
              >
                Login / Sign Up
              </Link>
            )}
          </div>
        </div>
      </header>

      <div
        style={{
          ...containerStyle,
          paddingTop: "28px",
          paddingBottom: "50px",
        }}
      >
        {/* ======================================================
            ACCOUNT WELCOME
        ====================================================== */}

        <section
          style={{
            ...cardStyle,
            padding: "24px",
            marginBottom: "20px",
            background:
              "linear-gradient(135deg, #0B3B75, #15579D)",
            color: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  opacity: 0.8,
                  marginBottom: "6px",
                }}
              >
                WELCOME BACK
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: "28px",
                }}
              >
                {name ||
                  "Property Owner"}
              </h1>

              <p
                style={{
                  margin:
                    "8px 0 0",
                  opacity: 0.9,
                }}
              >
                Manage your properties,
                photos and tenant
                viewing requests.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  background:
                    "rgba(255,255,255,0.12)",
                  padding: "14px 17px",
                  borderRadius:
                    "12px",
                  minWidth: "180px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    opacity: 0.8,
                  }}
                >
                  LANDLORD PHONE
                </div>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      "4px",
                  }}
                >
                  {phone ||
                    "Not provided"}
                </strong>
              </div>

              <button
                type="button"
                onClick={
                  refreshDashboard
                }
                disabled={
                  loadingDashboard
                }
                style={{
                  padding:
                    "12px 15px",
                  border:
                    "1px solid rgba(255,255,255,0.35)",
                  background:
                    "rgba(255,255,255,0.1)",
                  color:
                    "white",
                  borderRadius:
                    "9px",
                  fontWeight:
                    "bold",
                  cursor:
                    loadingDashboard
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    loadingDashboard
                      ? 0.6
                      : 1,
                }}
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        </section>

        {/* ======================================================
            NAVIGATION
        ====================================================== */}

        <nav
          style={{
            ...cardStyle,
            padding: "8px",
            marginBottom: "20px",
            display: "flex",
            gap: "6px",
            overflowX: "auto",
          }}
        >
          {[
            {
              id: "dashboard",
              label: "📊 Dashboard",
            },
            {
              id: "properties",
              label: "🏠 My Properties",
            },
            {
              id: "requests",
              label: "📅 Requests",
            },
            {
              id: "add",
              label: "＋ Add Property",
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                setActiveSection(
                  item.id as
                    | "dashboard"
                    | "properties"
                    | "requests"
                    | "add"
                )
              }
              style={{
                flex: "0 0 auto",
                padding:
                  "11px 15px",
                border: "none",
                borderRadius:
                  "9px",
                background:
                  activeSection ===
                  item.id
                    ? "#0B3B75"
                    : "transparent",
                color:
                  activeSection ===
                  item.id
                    ? "white"
                    : "#486581",
                fontWeight:
                  "bold",
                cursor:
                  "pointer",
                position:
                  "relative",
              }}
            >
              {item.label}

              {item.id ===
                "requests" &&
                pendingRequests >
                  0 && (
                  <span
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      minWidth:
                        "20px",
                      height:
                        "20px",
                      marginLeft:
                        "7px",
                      padding:
                        "0 5px",
                      borderRadius:
                        "10px",
                      background:
                        activeSection ===
                        item.id
                          ? "#FBBF24"
                          : "#B42318",
                      color:
                        activeSection ===
                        item.id
                          ? "#102A43"
                          : "white",
                      fontSize:
                        "11px",
                      fontWeight:
                        "bold",
                    }}
                  >
                    {
                      pendingRequests
                    }
                  </span>
                )}
            </button>
          ))}
        </nav>

        {/* ======================================================
            GLOBAL LOADING
        ====================================================== */}

        {loadingDashboard && (
          <div
            style={{
              ...cardStyle,
              padding: "22px",
              marginBottom: "20px",
              textAlign: "center",
              color: "#486581",
            }}
          >
            Loading your landlord
            dashboard...
          </div>
        )}

        {/* ======================================================
            GLOBAL ERROR
        ====================================================== */}

        {dashboardError && (
          <div
            role="alert"
            style={{
              background: "#FEE4E2",
              color: "#B42318",
              border:
                "1px solid #FDA29B",
              padding: "15px",
              borderRadius: "10px",
              marginBottom: "20px",
              fontWeight: "bold",
            }}
          >
            {dashboardError}
          </div>
        )}

        {!userId && !loadingDashboard && (
          <div
            style={{
              background: "white",
              border:
                "1px solid #D9E2EC",
              borderRadius: "14px",
              padding: "26px",
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "#0B3B75",
                marginBottom: "8px",
              }}
            >
              Landlord Login
            </div>

            <p
              style={{
                color: "#475467",
                margin: "0 0 18px 0",
              }}
            >
              Log in to list your properties,
              manage photos and respond to
              tenant viewing requests. New here?
              Create a free landlord account.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/auth?mode=login"
                style={{
                  padding: "12px 24px",
                  borderRadius: "9px",
                  background: "#0B3B75",
                  color: "white",
                  fontWeight: "bold",
                  textDecoration: "none",
                }}
              >
                Log in
              </Link>

              <Link
                href="/auth"
                style={{
                  padding: "12px 24px",
                  borderRadius: "9px",
                  border:
                    "1px solid #0B3B75",
                  color: "#0B3B75",
                  fontWeight: "bold",
                  textDecoration: "none",
                }}
              >
                Create landlord account
              </Link>
            </div>
          </div>
        )}

        {/* ======================================================
            ACTION MESSAGE
        ====================================================== */}

        {actionMessage && (
          <div
            style={{
              background: "#ECFDF3",
              color: "#067647",
              border:
                "1px solid #ABEFC6",
              padding: "13px 15px",
              borderRadius: "10px",
              marginBottom: "20px",
              fontWeight: "bold",
            }}
          >
            ✓ {actionMessage}
          </div>
        )}

        {/* ======================================================
            DASHBOARD
        ====================================================== */}

        {activeSection ===
          "dashboard" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(170px, 1fr))",
                gap: "14px",
                marginBottom: "22px",
              }}
            >
              {[
                {
                  label:
                    "Total Properties",
                  value:
                    totalProperties,
                  icon: "🏠",
                },
                {
                  label:
                    "Approved",
                  value:
                    approvedProperties,
                  icon: "✓",
                },
                {
                  label:
                    "Pending",
                  value:
                    pendingProperties,
                  icon: "⏳",
                },
                {
                  label:
                    "Rejected",
                  value:
                    rejectedProperties,
                  icon: "✕",
                },
                {
                  label:
                    "Pending Requests",
                  value:
                    pendingRequests,
                  icon: "📅",
                },
              ].map(
                (stat) => (
                  <div
                    key={
                      stat.label
                    }
                    style={{
                      ...cardStyle,
                      padding:
                        "20px",
                    }}
                  >
                    <div
                      style={{
                        fontSize:
                          "25px",
                        marginBottom:
                          "9px",
                      }}
                    >
                      {
                        stat.icon
                      }
                    </div>

                    <div
                      style={{
                        fontSize:
                          "29px",
                        fontWeight:
                          "bold",
                        color:
                          "#0B3B75",
                      }}
                    >
                      {
                        stat.value
                      }
                    </div>

                    <div
                      style={{
                        color:
                          "#627D98",
                        fontSize:
                          "13px",
                        marginTop:
                          "4px",
                      }}
                    >
                      {
                        stat.label
                      }
                    </div>
                  </div>
                )
              )}
            </div>

            <section
              style={{
                ...cardStyle,
                padding: "24px",
                marginBottom:
                  "20px",
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  color: "#0B3B75",
                }}
              >
                Quick Actions
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setActiveSection(
                      "add"
                    )
                  }
                  style={{
                    ...primaryButton,
                    padding:
                      "17px",
                    textAlign:
                      "left",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "22px",
                    }}
                  >
                    ＋
                  </div>

                  <div
                    style={{
                      marginTop:
                        "6px",
                    }}
                  >
                    Add Property
                  </div>

                  <small
                    style={{
                      display:
                        "block",
                      opacity:
                        0.75,
                      marginTop:
                        "4px",
                    }}
                  >
                    List a new
                    property
                  </small>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveSection(
                      "properties"
                    )
                  }
                  style={{
                    ...secondaryButton,
                    padding:
                      "17px",
                    textAlign:
                      "left",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "22px",
                    }}
                  >
                    🏠
                  </div>

                  <div
                    style={{
                      marginTop:
                        "6px",
                    }}
                  >
                    Manage Properties
                  </div>

                  <small
                    style={{
                      display:
                        "block",
                      color:
                        "#627D98",
                      marginTop:
                        "4px",
                    }}
                  >
                    Edit photos and
                    details
                  </small>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveSection(
                      "requests"
                    )
                  }
                  style={{
                    ...secondaryButton,
                    padding:
                      "17px",
                    textAlign:
                      "left",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "22px",
                    }}
                  >
                    📅
                  </div>

                  <div
                    style={{
                      marginTop:
                        "6px",
                    }}
                  >
                    Viewing Requests
                  </div>

                  <small
                    style={{
                      display:
                        "block",
                      color:
                        "#627D98",
                      marginTop:
                        "4px",
                    }}
                  >
                    {pendingRequests}{" "}
                    pending
                    request
                    {pendingRequests ===
                    1
                      ? ""
                      : "s"}
                  </small>
                </button>
              </div>
            </section>

            <section
              style={{
                ...cardStyle,
                padding: "24px",
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  color: "#0B3B75",
                }}
              >
                Recent Properties
              </h2>

              {properties.length ===
              0 ? (
                <div
                  style={{
                    padding:
                      "25px",
                    background:
                      "#F8FAFC",
                    borderRadius:
                      "10px",
                    textAlign:
                      "center",
                    color:
                      "#627D98",
                  }}
                >
                  You have not
                  listed a property
                  yet.
                </div>
              ) : (
                properties
                  .slice(0, 3)
                  .map(
                    (property) => (
                      <div
                        key={
                          property.id
                        }
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap: "15px",
                          alignItems:
                            "center",
                          padding:
                            "15px 0",
                          borderBottom:
                            "1px solid #E5E7EB",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              color:
                                "#0B3B75",
                            }}
                          >
                            {
                              property.title
                            }
                          </strong>

                          <div
                            style={{
                              color:
                                "#627D98",
                              fontSize:
                                "13px",
                              marginTop:
                                "4px",
                            }}
                          >
                            📍{" "}
                            {
                              property.location
                            }
                          </div>
                        </div>

                        <span
                          style={{
                            ...statusStyle(
                              property.status
                            ),
                            padding:
                              "6px 10px",
                            borderRadius:
                              "20px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "bold",
                          }}
                        >
                          {
                            property.status
                          }
                        </span>
                      </div>
                    )
                  )
              )}
            </section>
          </>
        )}

        {/* ======================================================
            PROPERTIES SECTION
        ====================================================== */}

        {activeSection ===
          "properties" && (
          <section
            style={{
              ...cardStyle,
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: "15px",
                flexWrap:
                  "wrap",
              }}
            >
              <div>
                <h1
                  style={{
                    color:
                      "#0B3B75",
                    marginTop: 0,
                    marginBottom:
                      "6px",
                  }}
                >
                  My Properties
                </h1>

                <p
                  style={{
                    color:
                      "#627D98",
                    marginTop: 0,
                  }}
                >
                  Manage your
                  property listings,
                  photos and
                  information.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setActiveSection(
                    "add"
                  )
                }
                style={
                  primaryButton
                }
              >
                ＋ Add Property
              </button>
            </div>

            {/* SEARCH + FILTER */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(200px, 1fr) 220px",
                gap: "12px",
                margin:
                  "20px 0",
              }}
            >
              <input
                value={
                  propertySearch
                }
                onChange={(e) =>
                  setPropertySearch(
                    e.target
                      .value
                  )
                }
                placeholder="Search by property name, location or type..."
                style={{
                  ...inputStyle,
                  margin:
                    "0",
                }}
              />

              <select
                value={
                  propertyFilter
                }
                onChange={(e) =>
                  setPropertyFilter(
                    e.target
                      .value
                  )
                }
                style={{
                  ...inputStyle,
                  margin:
                    "0",
                }}
              >
                <option value="All">
                  All statuses
                </option>

                <option value="Approved">
                  Approved
                </option>

                <option value="Pending Verification">
                  Pending Verification
                </option>

                <option value="Rejected">
                  Rejected
                </option>
              </select>
            </div>

            {filteredProperties.length ===
            0 ? (
              <div
                style={{
                  padding:
                    "35px",
                  textAlign:
                    "center",
                  background:
                    "#F8FAFC",
                  borderRadius:
                    "12px",
                  color:
                    "#627D98",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "42px",
                  }}
                >
                  🏠
                </div>

                <strong>
                  No properties
                  found
                </strong>

                <p>
                  Try another
                  search or
                  filter.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: "18px",
                }}
              >
                {filteredProperties.map(
                  (property) => {
                    const images =
                      propertyImages[
                        property.id
                      ] || [];

                    const badge =
                      statusStyle(
                        property.status
                      );

                    return (
                      <article
                        key={
                          property.id
                        }
                        style={{
                          border:
                            "1px solid #D9E2EC",
                          borderRadius:
                            "14px",
                          overflow:
                            "hidden",
                          background:
                            "white",
                        }}
                      >
                        <div
                          style={{
                            height:
                              "190px",
                            background:
                              "#EAF0F6",
                            position:
                              "relative",
                          }}
                        >
                          {images.length >
                          0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                openGallery(
                                  property,
                                  0
                                )
                              }
                              style={{
                                border:
                                  "none",
                                padding:
                                  0,
                                margin:
                                  0,
                                width:
                                  "100%",
                                height:
                                  "100%",
                                cursor:
                                  "pointer",
                                background:
                                  "transparent",
                              }}
                            >
                              <img
                                src={getImageUrl(
                                  images[0]
                                    .storage_path
                                )}
                                alt={
                                  property.title
                                }
                                style={{
                                  width:
                                    "100%",
                                  height:
                                    "100%",
                                  objectFit:
                                    "cover",
                                }}
                              />
                            </button>
                          ) : (
                            <div
                              style={{
                                height:
                                  "100%",
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                color:
                                  "#829AB1",
                                fontSize:
                                  "45px",
                              }}
                            >
                              🏠
                            </div>
                          )}

                          <span
                            style={{
                              ...badge,
                              position:
                                "absolute",
                              top:
                                "12px",
                              right:
                                "12px",
                              padding:
                                "7px 10px",
                              borderRadius:
                                "20px",
                              fontSize:
                                "11px",
                              fontWeight:
                                "bold",
                            }}
                          >
                            {
                              property.status
                            }
                          </span>

                          {images.length >
                            0 && (
                            <span
                              style={{
                                position:
                                  "absolute",
                                bottom:
                                  "10px",
                                left:
                                  "10px",
                                background:
                                  "rgba(0,0,0,0.7)",
                                color:
                                  "white",
                                padding:
                                  "5px 9px",
                                borderRadius:
                                  "15px",
                                fontSize:
                                  "11px",
                              }}
                            >
                              📷{" "}
                              {
                                images.length
                              }{" "}
                              photo
                              {images.length ===
                              1
                                ? ""
                                : "s"}
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            padding:
                              "18px",
                          }}
                        >
                          <h2
                            style={{
                              margin:
                                "0 0 7px",
                              color:
                                "#0B3B75",
                              fontSize:
                                "19px",
                            }}
                          >
                            {
                              property.title
                            }
                          </h2>

                          <p
                            style={{
                              margin:
                                "0 0 7px",
                              color:
                                "#627D98",
                              fontSize:
                                "14px",
                            }}
                          >
                            📍{" "}
                            {
                              property.location
                            }
                          </p>

                          <strong
                            style={{
                              color:
                                "#102A43",
                            }}
                          >
                            UGX{" "}
                            {Number(
                              property.monthly_rent
                            ).toLocaleString()}
                            /month
                          </strong>

                          <p
                            style={{
                              color:
                                "#627D98",
                              fontSize:
                                "14px",
                            }}
                          >
                            🏠{" "}
                            {
                              property.property_type
                            }

                            {property.bedrooms !==
                            null
                              ? ` • ${property.bedrooms} bedroom${
                                  property.bedrooms ===
                                  1
                                    ? ""
                                    : "s"
                                }`
                              : ""}
                          </p>

                          {property.description && (
                            <p
                              style={{
                                color:
                                  "#627D98",
                                fontSize:
                                  "13px",
                                lineHeight:
                                  "1.5",
                                display:
                                  "-webkit-box",
                                WebkitLineClamp:
                                  3,
                                WebkitBoxOrient:
                                  "vertical",
                                overflow:
                                  "hidden",
                              }}
                            >
                              {
                                property.description
                              }
                            </p>
                          )}

                          {property.status ===
                            "Rejected" &&
                            property.rejection_reason && (
                              <div
                                style={{
                                  background:
                                    "#FEF2F2",
                                  color:
                                    "#991B1B",
                                  padding:
                                    "10px",
                                  borderRadius:
                                    "8px",
                                  fontSize:
                                    "12px",
                                  margin:
                                    "10px 0",
                                }}
                              >
                                <strong>
                                  Rejection
                                  reason:
                                </strong>
                                <br />
                                {
                                  property.rejection_reason
                                }
                              </div>
                            )}

                          <div
                            style={{
                              display:
                                "flex",
                              gap: "8px",
                              flexWrap:
                                "wrap",
                              marginTop:
                                "15px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openEditProperty(
                                  property
                                )
                              }
                              style={
                                secondaryButton
                              }
                            >
                              ✎ Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openPhotoManager(
                                  property
                                )
                              }
                              style={
                                secondaryButton
                              }
                            >
                              📷 Photos
                            </button>

                            {images.length >
                              0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  openGallery(
                                    property,
                                    0
                                  )
                                }
                                style={
                                  secondaryButton
                                }
                              >
                                👁 View
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

        {/* ======================================================
            VIEWING REQUESTS
        ====================================================== */}

        {activeSection ===
          "requests" && (
          <section
            style={{
              ...cardStyle,
              padding: "24px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: "15px",
                flexWrap:
                  "wrap",
              }}
            >
              <div>
                <h1
                  style={{
                    color:
                      "#0B3B75",
                    marginTop: 0,
                    marginBottom:
                      "6px",
                  }}
                >
                  Viewing Requests
                </h1>

                <p
                  style={{
                    color:
                      "#627D98",
                    marginTop: 0,
                  }}
                >
                  Manage people who
                  want to view your
                  properties.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  refreshDashboard
                }
                disabled={
                  loadingDashboard
                }
                style={{
                  ...secondaryButton,
                  opacity:
                    loadingDashboard
                      ? 0.6
                      : 1,
                }}
              >
                ↻ Refresh Requests
              </button>
            </div>

            {/* REQUEST STATISTICS */}

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "12px",
                margin:
                  "20px 0",
              }}
            >
              <div
                style={{
                  background:
                    "#FFF7E6",
                  padding:
                    "15px",
                  borderRadius:
                    "10px",
                  border:
                    "1px solid #FDE68A",
                }}
              >
                <strong
                  style={{
                    fontSize:
                      "22px",
                  }}
                >
                  {
                    pendingRequests
                  }
                </strong>

                <div
                  style={{
                    color:
                      "#92400E",
                    fontSize:
                      "13px",
                    marginTop:
                      "3px",
                  }}
                >
                  Pending
                </div>
              </div>

              <div
                style={{
                  background:
                    "#ECFDF3",
                  padding:
                    "15px",
                  borderRadius:
                    "10px",
                  border:
                    "1px solid #ABEFC6",
                }}
              >
                <strong
                  style={{
                    fontSize:
                      "22px",
                  }}
                >
                  {
                    acceptedRequests
                  }
                </strong>

                <div
                  style={{
                    color:
                      "#166534",
                    fontSize:
                      "13px",
                    marginTop:
                      "3px",
                  }}
                >
                  Accepted
                </div>
              </div>

              <div
                style={{
                  background:
                    "#FEF2F2",
                  padding:
                    "15px",
                  borderRadius:
                    "10px",
                  border:
                    "1px solid #FECACA",
                }}
              >
                <strong
                  style={{
                    fontSize:
                      "22px",
                  }}
                >
                  {
                    rejectedRequests
                  }
                </strong>

                <div
                  style={{
                    color:
                      "#991B1B",
                    fontSize:
                      "13px",
                    marginTop:
                      "3px",
                  }}
                >
                  Rejected
                </div>
              </div>

              <div
                style={{
                  background:
                    "#F1F5F9",
                  padding:
                    "15px",
                  borderRadius:
                    "10px",
                  border:
                    "1px solid #E2E8F0",
                }}
              >
                <strong
                  style={{
                    fontSize:
                      "22px",
                  }}
                >
                  {
                    requests.length
                  }
                </strong>

                <div
                  style={{
                    color:
                      "#475569",
                    fontSize:
                      "13px",
                    marginTop:
                      "3px",
                  }}
                >
                  Total Requests
                </div>
              </div>
            </div>

            {/* REQUEST SEARCH + FILTER */}

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "minmax(200px, 1fr) 210px",
                gap: "12px",
                margin:
                  "20px 0",
              }}
            >
              <input
                value={
                  requestSearch
                }
                onChange={(e) =>
                  setRequestSearch(
                    e.target
                      .value
                  )
                }
                placeholder="Search tenant, property, location or message..."
                style={{
                  ...inputStyle,
                  margin:
                    "0",
                }}
              />

              <select
                value={
                  requestFilter
                }
                onChange={(e) =>
                  setRequestFilter(
                    e.target
                      .value as
                      | "All"
                      | "Pending"
                      | "Accepted"
                      | "Rejected"
                  )
                }
                style={{
                  ...inputStyle,
                  margin:
                    "0",
                }}
              >
                <option value="All">
                  All requests
                </option>

                <option value="Pending">
                  Pending
                </option>

                <option value="Accepted">
                  Accepted
                </option>

                <option value="Rejected">
                  Rejected
                </option>
              </select>
            </div>

            {/* REQUEST LIST */}

            {filteredRequests.length ===
            0 ? (
              <div
                style={{
                  padding:
                    "35px",
                  textAlign:
                    "center",
                  background:
                    "#F8FAFC",
                  borderRadius:
                    "12px",
                  color:
                    "#627D98",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "45px",
                  }}
                >
                  📭
                </div>

                <strong>
                  {requests.length ===
                  0
                    ? "No viewing requests yet."
                    : "No requests match your search or filter."}
                </strong>

                <p>
                  {requests.length ===
                  0
                    ? "Requests from tenants will appear here."
                    : "Try changing the search or request status filter."}
                </p>
              </div>
            ) : (
              filteredRequests.map(
                (request) => (
                  <article
                    key={
                      request.id
                    }
                    style={{
                      border:
                        "1px solid #D9E2EC",
                      borderRadius:
                        "14px",
                      padding:
                        "20px",
                      marginTop:
                        "16px",
                      background:
                        "white",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: "15px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            margin:
                              "0 0 6px",
                            color:
                              "#0B3B75",
                            fontSize:
                              "19px",
                          }}
                        >
                          {
                            request.propertyTitle
                          }
                        </h2>

                        <p
                          style={{
                            margin:
                              0,
                            color:
                              "#627D98",
                          }}
                        >
                          📍{" "}
                          {
                            request.propertyLocation
                          }
                        </p>
                      </div>

                      <span
                        style={{
                          ...requestStatusStyle(
                            request.status
                          ),
                          padding:
                            "7px 11px",
                          borderRadius:
                            "20px",
                          fontWeight:
                            "bold",
                          fontSize:
                            "12px",
                          height:
                            "fit-content",
                        }}
                      >
                        {
                          request.status
                        }
                      </span>
                    </div>

                    <hr
                      style={{
                        border:
                          "none",
                        borderTop:
                          "1px solid #E5E7EB",
                        margin:
                          "17px 0",
                      }}
                    />

                    {/* TENANT INFORMATION */}

                    <div
                      style={{
                        background:
                          "#EEF4FA",
                        border:
                          "1px solid #D7E3EF",
                        padding:
                          "15px",
                        borderRadius:
                          "10px",
                        marginBottom:
                          "15px",
                      }}
                    >
                      <strong
                        style={{
                          color:
                            "#0B3B75",
                          display:
                            "block",
                          marginBottom:
                            "9px",
                        }}
                      >
                        👤 Tenant Information
                      </strong>

                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(210px, 1fr))",
                          gap:
                            "8px",
                        }}
                      >
                        <div>
                          <span
                            style={{
                              color:
                                "#627D98",
                              fontSize:
                                "12px",
                              display:
                                "block",
                            }}
                          >
                            NAME
                          </span>

                          <strong>
                            {request.tenantName ||
                              "Name unavailable"}
                          </strong>
                        </div>

                        <div>
                          <span
                            style={{
                              color:
                                "#627D98",
                              fontSize:
                                "12px",
                              display:
                                "block",
                            }}
                          >
                            PHONE
                          </span>

                          <strong>
                            {request.tenantPhone ||
                              "Phone unavailable"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* TENANT MESSAGE */}

                    <div
                      style={{
                        background:
                          "#F8FAFC",
                        padding:
                          "14px",
                        borderRadius:
                          "9px",
                        lineHeight:
                          "1.6",
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      <strong>
                        Tenant&apos;s message
                      </strong>

                      <p
                        style={{
                          margin:
                            "7px 0 0",
                        }}
                      >
                        {request.message ||
                          "No message provided."}
                      </p>
                    </div>

                    <p
                      style={{
                        color:
                          "#829AB1",
                        fontSize:
                          "12px",
                        marginBottom:
                          "14px",
                      }}
                    >
                      Submitted{" "}
                      {new Date(
                        request.created_at
                      ).toLocaleString()}
                    </p>

                    {/* PROPERTY ACTION */}

                    <div
                      style={{
                        display:
                          "flex",
                        gap:
                          "8px",
                        flexWrap:
                          "wrap",
                        marginBottom:
                          "15px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const property =
                            properties.find(
                              (item) =>
                                item.id ===
                                request.property_id
                            );

                          if (
                            property
                          ) {
                            const images =
                              propertyImages[
                                property.id
                              ] || [];

                            if (
                              images.length >
                              0
                            ) {
                              openGallery(
                                property,
                                0
                              );
                            } else {
                              setActionMessage(
                                "This property does not have any photos yet."
                              );
                            }
                          }
                        }}
                        style={
                          secondaryButton
                        }
                      >
                        📷 View Property Photos
                      </button>
                    </div>

                    {/* PENDING ACTIONS */}

                    {request.status ===
                      "Pending" && (
                      <>
                        <div
                          style={{
                            background:
                              "#FFF7E6",
                            color:
                              "#92400E",
                            padding:
                              "11px",
                            borderRadius:
                              "8px",
                            fontSize:
                              "13px",
                            marginBottom:
                              "14px",
                          }}
                        >
                          ⏳ This tenant is
                          waiting for your
                          response.
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
                            gap: "10px",
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <button
                            type="button"
                            disabled={
                              updatingRequest ===
                              request.id
                            }
                            onClick={() =>
                              updateRequestStatus(
                                request.id,
                                "Accepted"
                              )
                            }
                            style={{
                              ...primaryButton,
                              background:
                                "#087443",
                              flex:
                                "1 1 180px",
                              opacity:
                                updatingRequest ===
                                request.id
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            {updatingRequest ===
                            request.id
                              ? "UPDATING..."
                              : "✓ ACCEPT REQUEST"}
                          </button>

                          <button
                            type="button"
                            disabled={
                              updatingRequest ===
                              request.id
                            }
                            onClick={() =>
                              updateRequestStatus(
                                request.id,
                                "Rejected"
                              )
                            }
                            style={{
                              ...primaryButton,
                              background:
                                "#B42318",
                              flex:
                                "1 1 180px",
                              opacity:
                                updatingRequest ===
                                request.id
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            {updatingRequest ===
                            request.id
                              ? "UPDATING..."
                              : "✕ REJECT REQUEST"}
                          </button>
                        </div>
                      </>
                    )}

                    {/* ACCEPTED */}

                    {request.status ===
                      "Accepted" && (
                      <div
                        style={{
                          background:
                            "#ECFDF3",
                          border:
                            "1px solid #ABEFC6",
                          padding:
                            "15px",
                          borderRadius:
                            "10px",
                          color:
                            "#166534",
                        }}
                      >
                        <strong>
                          ✓ Viewing request
                          accepted
                        </strong>

                        <p
                          style={{
                            margin:
                              "8px 0 0",
                            fontSize:
                              "13px",
                          }}
                        >
                          The tenant has
                          been informed that
                          you accepted the
                          viewing request.
                        </p>
                      </div>
                    )}

                    {/* REJECTED */}

                    {request.status ===
                      "Rejected" && (
                      <div
                        style={{
                          background:
                            "#FEF2F2",
                          color:
                            "#991B1B",
                          padding:
                            "12px",
                          borderRadius:
                            "8px",
                          fontSize:
                            "13px",
                        }}
                      >
                        ✕ This viewing
                        request was
                        rejected.
                      </div>
                    )}
                  </article>
                )
              )
            )}
          </section>
        )}

        {/* ======================================================
            ADD PROPERTY
        ====================================================== */}

        {activeSection ===
          "add" && (
          <>
            {submitted ? (
              <section
                style={{
                  ...cardStyle,
                  padding:
                    "45px 25px",
                  textAlign:
                    "center",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "60px",
                  }}
                >
                  ✅
                </div>

                <h1
                  style={{
                    color:
                      "#0B3B75",
                  }}
                >
                  Property Submitted
                  Successfully
                </h1>

                <p
                  style={{
                    color:
                      "#627D98",
                    lineHeight:
                      "1.6",
                    maxWidth:
                      "650px",
                    margin:
                      "0 auto 18px",
                  }}
                >
                  Your property has
                  been received by
                  House Connect and
                  is now awaiting
                  verification.
                </p>

                <div
                  style={{
                    display:
                      "inline-block",
                    background:
                      "#FEF3C7",
                    color:
                      "#92400E",
                    border:
                      "1px solid #FDE68A",
                    padding:
                      "12px 18px",
                    borderRadius:
                      "10px",
                    fontWeight:
                      "bold",
                  }}
                >
                  ⏳ Pending
                  Verification
                </div>

                <p
                  style={{
                    color:
                      "#627D98",
                    marginTop:
                      "20px",
                    lineHeight:
                      "1.6",
                  }}
                >
                  Once approved by
                  House Connect, your
                  property can appear
                  to house seekers.
                </p>

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "center",
                    gap: "10px",
                    flexWrap:
                      "wrap",
                    marginTop:
                      "22px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      resetNewPropertyForm();
                      setActiveSection(
                        "properties"
                      );
                    }}
                    style={
                      secondaryButton
                    }
                  >
                    VIEW MY PROPERTIES
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      resetNewPropertyForm();
                      setActiveSection(
                        "add"
                      );
                    }}
                    style={
                      primaryButton
                    }
                  >
                    ADD ANOTHER PROPERTY
                  </button>
                </div>
              </section>
            ) : (
              <section>
                <div
                  style={{
                    textAlign:
                      "center",
                    marginBottom:
                      "22px",
                  }}
                >
                  <h1
                    style={{
                      color:
                        "#0B3B75",
                    }}
                  >
                    List Your Property
                  </h1>

                  <p
                    style={{
                      color:
                        "#627D98",
                    }}
                  >
                    Give tenants
                    accurate information
                    and clear photos so
                    they can make better
                    decisions.
                  </p>
                </div>

                <form
                  onSubmit={
                    submitProperty
                  }
                  style={{
                    ...cardStyle,
                    padding:
                      "25px",
                  }}
                >
                  <h2
                    style={{
                      color:
                        "#0B3B75",
                    }}
                  >
                    👤 Landlord Details
                  </h2>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Full Name *
                    <input
                      style={
                        inputStyle
                      }
                      value={
                        name
                      }
                      onChange={(e) =>
                        setName(
                          e.target
                            .value
                        )
                      }
                      placeholder="Your full name"
                      required
                    />
                  </label>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Phone Number *
                    <input
                      style={
                        inputStyle
                      }
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={
                        phone
                      }
                      onChange={(
                        e
                      ) =>
                        setPhone(
                          e.target.value.replace(
                            /\D/g,
                            ""
                          )
                        )
                      }
                      placeholder="07XXXXXXXX"
                      required
                    />
                  </label>

                  <hr
                    style={{
                      border:
                        "none",
                      borderTop:
                        "1px solid #E5E7EB",
                      margin:
                        "25px 0",
                    }}
                  />

                  <h2
                    style={{
                      color:
                        "#0B3B75",
                    }}
                  >
                    🏡 Property Details
                  </h2>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Property Title *
                    <input
                      style={
                        inputStyle
                      }
                      value={
                        title
                      }
                      onChange={(e) =>
                        setTitle(
                          e.target
                            .value
                        )
                      }
                      placeholder="e.g. 2 Bedroom House in Kira"
                      required
                    />
                  </label>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Property Location *
                    <input
                      style={
                        inputStyle
                      }
                      value={
                        location
                      }
                      onChange={(e) =>
                        setLocation(
                          e.target
                            .value
                        )
                      }
                      placeholder="e.g. Kira, Wakiso"
                      required
                    />
                  </label>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Property Type *
                    <select
                      style={
                        inputStyle
                      }
                      value={
                        type
                      }
                      onChange={(e) =>
                        setType(
                          e.target
                            .value
                        )
                      }
                    >
                      {PROPERTY_TYPES.map(
                        (
                          propertyType
                        ) => (
                          <option
                            key={
                              propertyType
                            }
                            value={
                              propertyType
                            }
                          >
                            {
                              propertyType
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Monthly Rent
                    (UGX) *
                    <input
                      style={
                        inputStyle
                      }
                      type="number"
                      min="1"
                      value={
                        rent
                      }
                      onChange={(e) =>
                        setRent(
                          e.target
                            .value
                        )
                      }
                      placeholder="e.g. 650000"
                      required
                    />
                  </label>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Number of
                    Bedrooms
                    <input
                      style={
                        inputStyle
                      }
                      type="number"
                      min="0"
                      value={
                        bedrooms
                      }
                      onChange={(e) =>
                        setBedrooms(
                          e.target
                            .value
                        )
                      }
                      placeholder="e.g. 2"
                    />
                  </label>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Property Description
                    <textarea
                      style={{
                        ...inputStyle,
                        minHeight:
                          "120px",
                        resize:
                          "vertical",
                      }}
                      value={
                        description
                      }
                      onChange={(e) =>
                        setDescription(
                          e.target
                            .value
                        )
                      }
                      placeholder="Describe security, water, electricity, parking, nearby roads, schools, shops and other useful information..."
                    />
                  </label>

                  {/* PHOTOS */}

                  <div
                    style={{
                      marginTop:
                        "5px",
                    }}
                  >
                    <h3
                      style={{
                        color:
                          "#0B3B75",
                      }}
                    >
                      📷 Property Photos
                    </h3>

                    <p
                      style={{
                        color:
                          "#627D98",
                        fontSize:
                          "13px",
                        lineHeight:
                          "1.5",
                      }}
                    >
                      Add up to{" "}
                      {MAX_PHOTOS} clear
                      photos. Your first
                      photo will be used
                      as the main property
                      image.
                    </p>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={
                        handlePhotoSelection
                      }
                      disabled={
                        selectedPhotos.length >=
                        MAX_PHOTOS
                      }
                      style={{
                        width:
                          "100%",
                        padding:
                          "13px",
                        border:
                          "1px dashed #94A3B8",
                        borderRadius:
                          "9px",
                        boxSizing:
                          "border-box",
                        background:
                          "#F8FAFC",
                      }}
                    />

                    <p
                      style={{
                        color:
                          "#829AB1",
                        fontSize:
                          "12px",
                      }}
                    >
                      JPG, PNG or WEBP •
                      Maximum 12 MB per
                      photo •{" "}
                      {
                        selectedPhotos.length
                      }
                      /{MAX_PHOTOS}
                    </p>

                    {photoError && (
                      <div
                        role="alert"
                        style={{
                          color:
                            "#B42318",
                          background:
                            "#FEE4E2",
                          padding:
                            "11px",
                          borderRadius:
                            "8px",
                          fontSize:
                            "13px",
                          marginBottom:
                            "12px",
                        }}
                      >
                        {
                          photoError
                        }
                      </div>
                    )}

                    {selectedPhotos.length >
                      0 && (
                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(130px, 1fr))",
                          gap: "12px",
                          marginTop:
                            "15px",
                        }}
                      >
                        {selectedPhotos.map(
                          (
                            photo,
                            index
                          ) => (
                            <div
                              key={
                                photo.id
                              }
                              style={{
                                position:
                                  "relative",
                                border:
                                  "1px solid #D9E2EC",
                                borderRadius:
                                  "10px",
                                overflow:
                                  "hidden",
                              }}
                            >
                              <img
                                src={
                                  photo.preview
                                }
                                alt={`Property photo ${
                                  index +
                                  1
                                }`}
                                style={{
                                  width:
                                    "100%",
                                  height:
                                    "135px",
                                  objectFit:
                                    "cover",
                                  display:
                                    "block",
                                }}
                              />

                              <div
                                style={{
                                  padding:
                                    "7px",
                                  fontSize:
                                    "12px",
                                  color:
                                    "#627D98",
                                }}
                              >
                                Photo{" "}
                                {index +
                                  1}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  removeSelectedPhoto(
                                    photo.id
                                  )
                                }
                                style={{
                                  position:
                                    "absolute",
                                  top:
                                    "7px",
                                  right:
                                    "7px",
                                  width:
                                    "30px",
                                  height:
                                    "30px",
                                  border:
                                    "none",
                                  borderRadius:
                                    "50%",
                                  background:
                                    "#B42318",
                                  color:
                                    "white",
                                  fontWeight:
                                    "bold",
                                  fontSize:
                                    "18px",
                                  cursor:
                                    "pointer",
                                }}
                              >
                                ×
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div
                      role="alert"
                      style={{
                        color:
                          "#B42318",
                        background:
                          "#FEE4E2",
                        padding:
                          "13px",
                        borderRadius:
                          "9px",
                        fontWeight:
                          "bold",
                        lineHeight:
                          "1.5",
                        marginTop:
                          "20px",
                      }}
                    >
                      {
                        error
                      }
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      submitting
                    }
                    style={{
                      width:
                        "100%",
                      padding:
                        "17px",
                      marginTop:
                        "20px",
                      background:
                        submitting
                          ? "#7893B2"
                          : "#0B3B75",
                      color:
                        "white",
                      border:
                        "none",
                      borderRadius:
                        "10px",
                      fontSize:
                        "15px",
                      fontWeight:
                        "bold",
                      cursor:
                        submitting
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {submitting
                      ? "SUBMITTING PROPERTY..."
                      : "SUBMIT PROPERTY"}
                  </button>

                  {submitting && (
                    <p
                      style={{
                        textAlign:
                          "center",
                        color:
                          "#627D98",
                        fontSize:
                          "13px",
                      }}
                    >
                      Saving your
                      property and
                      uploading photos.
                      Please wait...
                    </p>
                  )}
                </form>
              </section>
            )}
          </>
        )}
      </div>

      {/* ========================================================
          EDIT PROPERTY MODAL
      ======================================================== */}

      {editingProperty && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(15, 23, 42, 0.65)",
            zIndex: 100,
            padding:
              "20px",
            overflowY:
              "auto",
          }}
        >
          <div
            style={{
              maxWidth:
                "650px",
              margin:
                "30px auto",
              background:
                "white",
              borderRadius:
                "16px",
              padding:
                "25px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap:
                  "10px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin:
                      0,
                    color:
                      "#0B3B75",
                  }}
                >
                  Edit Property
                </h2>

                <p
                  style={{
                    color:
                      "#627D98",
                    fontSize:
                      "13px",
                  }}
                >
                  Changes will be
                  reviewed before
                  becoming publicly
                  visible.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setEditingProperty(
                    null
                  )
                }
                style={{
                  border:
                    "none",
                  background:
                    "#F1F5F9",
                  width:
                    "36px",
                  height:
                    "36px",
                  borderRadius:
                    "50%",
                  fontSize:
                    "20px",
                  cursor:
                    "pointer",
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                saveEditedProperty
              }
            >
              <label
                style={
                  labelStyle
                }
              >
                Property Title *
                <input
                  style={
                    inputStyle
                  }
                  value={
                    editForm.title
                  }
                  onChange={(e) =>
                    setEditForm(
                      {
                        ...editForm,
                        title:
                          e.target
                            .value,
                      }
                    )
                  }
                  required
                />
              </label>

              <label
                style={
                  labelStyle
                }
              >
                Location *
                <input
                  style={
                    inputStyle
                  }
                  value={
                    editForm.location
                  }
                  onChange={(e) =>
                    setEditForm(
                      {
                        ...editForm,
                        location:
                          e.target
                            .value,
                      }
                    )
                  }
                  required
                />
              </label>

              <label
                style={
                  labelStyle
                }
              >
                Property Type *
                <select
                  style={
                    inputStyle
                  }
                  value={
                    editForm.property_type
                  }
                  onChange={(e) =>
                    setEditForm(
                      {
                        ...editForm,
                        property_type:
                          e.target
                            .value,
                      }
                    )
                  }
                >
                  {PROPERTY_TYPES.map(
                    (
                      propertyType
                    ) => (
                      <option
                        key={
                          propertyType
                        }
                        value={
                          propertyType
                        }
                      >
                        {
                          propertyType
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label
                style={
                  labelStyle
                }
              >
                Monthly Rent *
                <input
                  style={
                    inputStyle
                  }
                  type="number"
                  min="1"
                  value={
                    editForm.monthly_rent
                  }
                  onChange={(e) =>
                    setEditForm(
                      {
                        ...editForm,
                        monthly_rent:
                          e.target
                            .value,
                      }
                    )
                  }
                  required
                />
              </label>

              <label
                style={
                  labelStyle
                }
              >
                Bedrooms
                <input
                  style={
                    inputStyle
                  }
                  type="number"
                  min="0"
                  value={
                    editForm.bedrooms
                  }
                  onChange={(e) =>
                    setEditForm(
                      {
                        ...editForm,
                        bedrooms:
                          e.target
                            .value,
                      }
                    )
                  }
                />
              </label>

              <label
                style={
                  labelStyle
                }
              >
                Description
                <textarea
                  style={{
                    ...inputStyle,
                    minHeight:
                      "120px",
                    resize:
                      "vertical",
                  }}
                  value={
                    editForm.description
                  }
                  onChange={(e) =>
                    setEditForm(
                      {
                        ...editForm,
                        description:
                          e.target
                            .value,
                      }
                    )
                  }
                />
              </label>

              {editError && (
                <div
                  role="alert"
                  style={{
                    background:
                      "#FEE4E2",
                    color:
                      "#B42318",
                    padding:
                      "12px",
                    borderRadius:
                      "8px",
                    marginBottom:
                      "12px",
                  }}
                >
                  {
                    editError
                  }
                </div>
              )}

              {editSuccess && (
                <div
                  style={{
                    background:
                      "#ECFDF3",
                    color:
                      "#067647",
                    padding:
                      "12px",
                    borderRadius:
                      "8px",
                    marginBottom:
                      "12px",
                  }}
                >
                  ✓{" "}
                  {
                    editSuccess
                  }
                </div>
              )}

              <div
                style={{
                  background:
                    "#FFF7E6",
                  color:
                    "#92400E",
                  padding:
                    "12px",
                  borderRadius:
                    "8px",
                  fontSize:
                    "13px",
                  marginBottom:
                    "15px",
                }}
              >
                ℹ️ Editing the
                property details
                sends it back for
                verification. This
                protects tenants from
                unreviewed changes.
              </div>

              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "10px",
                  justifyContent:
                    "flex-end",
                  flexWrap:
                    "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setEditingProperty(
                      null
                    )
                  }
                  style={
                    secondaryButton
                  }
                >
                  CANCEL
                </button>

                <button
                  type="submit"
                  disabled={
                    savingEdit
                  }
                  style={{
                    ...primaryButton,
                    opacity:
                      savingEdit
                        ? 0.6
                        : 1,
                  }}
                >
                  {savingEdit
                    ? "SAVING..."
                    : "SAVE CHANGES"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          PHOTO MANAGEMENT MODAL
      ======================================================== */}

      {photoProperty && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(15, 23, 42, 0.65)",
            zIndex: 100,
            padding:
              "20px",
            overflowY:
              "auto",
          }}
        >
          <div
            style={{
              maxWidth:
                "750px",
              margin:
                "30px auto",
              background:
                "white",
              borderRadius:
                "16px",
              padding:
                "25px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                gap:
                  "10px",
                alignItems:
                  "center",
              }}
            >
              <div>
                <h2
                  style={{
                    margin:
                      0,
                    color:
                      "#0B3B75",
                  }}
                >
                  Manage Photos
                </h2>

                <p
                  style={{
                    color:
                      "#627D98",
                    margin:
                      "5px 0 0",
                  }}
                >
                  {
                    photoProperty.title
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPhotoProperty(
                    null
                  )
                }
                style={{
                  border:
                    "none",
                  background:
                    "#F1F5F9",
                  width:
                    "36px",
                  height:
                    "36px",
                  borderRadius:
                    "50%",
                  fontSize:
                    "20px",
                  cursor:
                    "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                marginTop:
                  "20px",
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "12px",
              }}
            >
              {(propertyImages[
                photoProperty.id
              ] || []).map(
                (image, index) => (
                  <div
                    key={
                      image.id
                    }
                    style={{
                      border:
                        "1px solid #D9E2EC",
                      borderRadius:
                        "10px",
                      overflow:
                        "hidden",
                      position:
                        "relative",
                    }}
                  >
                    <img
                      src={getImageUrl(
                        image.storage_path
                      )}
                      alt={`Property photo ${
                        index +
                        1
                      }`}
                      style={{
                        width:
                          "100%",
                        height:
                          "145px",
                        objectFit:
                          "cover",
                        display:
                          "block",
                      }}
                    />

                    {index ===
                      0 && (
                      <span
                        style={{
                          position:
                            "absolute",
                          left:
                            "7px",
                          top:
                            "7px",
                          background:
                            "#0B3B75",
                          color:
                            "white",
                          padding:
                            "5px 8px",
                          borderRadius:
                            "12px",
                          fontSize:
                            "10px",
                          fontWeight:
                            "bold",
                        }}
                      >
                        MAIN PHOTO
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        deletePropertyPhoto(
                          image
                        )
                      }
                      style={{
                        width:
                          "100%",
                        padding:
                          "9px",
                        border:
                          "none",
                        background:
                          "#FEF2F2",
                        color:
                          "#B42318",
                        fontWeight:
                          "bold",
                        cursor:
                          "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )
              )}
            </div>

            <hr
              style={{
                border:
                  "none",
                borderTop:
                  "1px solid #E5E7EB",
                margin:
                  "25px 0",
              }}
            />

            <h3
              style={{
                color:
                  "#0B3B75",
              }}
            >
              Add More Photos
            </h3>

            <p
              style={{
                color:
                  "#627D98",
                fontSize:
                  "13px",
              }}
            >
              Maximum {MAX_PHOTOS} photos
              per property.
              Current:{" "}
              {
                (
                  propertyImages[
                    photoProperty
                      .id
                  ] || []
                ).length
              }
              /{MAX_PHOTOS}
            </p>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={
                handleAdditionalPhotoSelection
              }
              disabled={
                (
                  propertyImages[
                    photoProperty.id
                  ] || []
                ).length +
                  additionalPhotos.length >=
                MAX_PHOTOS
              }
              style={{
                width:
                  "100%",
                padding:
                  "13px",
                border:
                  "1px dashed #94A3B8",
                borderRadius:
                  "9px",
                boxSizing:
                  "border-box",
                background:
                  "#F8FAFC",
              }}
            />

            {additionalPhotoError && (
              <div
                style={{
                  background:
                    "#FEE4E2",
                  color:
                    "#B42318",
                  padding:
                    "11px",
                  borderRadius:
                    "8px",
                  fontSize:
                    "13px",
                  marginTop:
                    "10px",
                }}
              >
                {
                  additionalPhotoError
                }
              </div>
            )}

            {additionalPhotos.length >
              0 && (
              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "10px",
                  marginTop:
                    "15px",
                }}
              >
                {additionalPhotos.map(
                  (
                    photo
                  ) => (
                    <div
                      key={
                        photo.id
                      }
                      style={{
                        position:
                          "relative",
                      }}
                    >
                      <img
                        src={
                          photo.preview
                        }
                        alt="New property photo"
                        style={{
                          width:
                            "100%",
                          height:
                            "120px",
                          objectFit:
                            "cover",
                          borderRadius:
                            "8px",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeAdditionalPhoto(
                            photo.id
                          )
                        }
                        style={{
                          position:
                            "absolute",
                          top:
                            "5px",
                          right:
                            "5px",
                          width:
                            "28px",
                          height:
                            "28px",
                          border:
                            "none",
                          borderRadius:
                            "50%",
                          background:
                            "#B42318",
                          color:
                            "white",
                          cursor:
                            "pointer",
                          fontWeight:
                            "bold",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "flex-end",
                gap:
                  "10px",
                marginTop:
                  "20px",
                flexWrap:
                  "wrap",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setPhotoProperty(
                    null
                  )
                }
                style={
                  secondaryButton
                }
              >
                CLOSE
              </button>

              <button
                type="button"
                disabled={
                  uploadingAdditionalPhotos ||
                  additionalPhotos.length ===
                    0
                }
                onClick={
                  uploadAdditionalPhotos
                }
                style={{
                  ...primaryButton,
                  opacity:
                    uploadingAdditionalPhotos ||
                    additionalPhotos.length ===
                      0
                      ? 0.55
                      : 1,
                }}
              >
                {uploadingAdditionalPhotos
                  ? "UPLOADING..."
                  : "UPLOAD PHOTOS"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          IMAGE GALLERY MODAL
      ======================================================== */}

      {galleryProperty &&
        (propertyImages[
          galleryProperty.id
        ] || []).length > 0 && (
          <div
            style={{
              position:
                "fixed",
              inset: 0,
              background:
                "rgba(0,0,0,0.92)",
              zIndex: 120,
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              padding:
                "20px",
            }}
          >
            {(() => {
              const images =
                propertyImages[
                  galleryProperty
                    .id
                ] || [];

              const current =
                images[
                  galleryIndex
                ];

              return (
                <div
                  style={{
                    width:
                      "100%",
                    maxWidth:
                      "1000px",
                    position:
                      "relative",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryProperty(
                        null
                      )
                    }
                    style={{
                      position:
                        "absolute",
                      top:
                        "-5px",
                      right:
                        "0",
                      width:
                        "40px",
                      height:
                        "40px",
                      border:
                        "none",
                      borderRadius:
                        "50%",
                      background:
                        "rgba(255,255,255,0.15)",
                      color:
                        "white",
                      fontSize:
                        "25px",
                      cursor:
                        "pointer",
                      zIndex:
                        2,
                    }}
                  >
                    ×
                  </button>

                  <div
                    style={{
                      textAlign:
                        "center",
                      color:
                        "white",
                      marginBottom:
                        "12px",
                    }}
                  >
                    <strong>
                      {
                        galleryProperty.title
                      }
                    </strong>

                    <div
                      style={{
                        fontSize:
                          "12px",
                        opacity:
                          0.75,
                        marginTop:
                          "4px",
                      }}
                    >
                      {galleryIndex +
                        1}{" "}
                      /{" "}
                      {
                        images.length
                      }
                    </div>
                  </div>

                  <div
                    style={{
                      position:
                        "relative",
                      background:
                        "#111827",
                      borderRadius:
                        "12px",
                      overflow:
                        "hidden",
                    }}
                  >
                    <img
                      src={getImageUrl(
                        current
                          .storage_path
                      )}
                      alt={
                        galleryProperty.title
                      }
                      style={{
                        display:
                          "block",
                        width:
                          "100%",
                        maxHeight:
                          "70vh",
                        objectFit:
                          "contain",
                      }}
                    />

                    {images.length >
                      1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setGalleryIndex(
                              (
                                galleryIndex -
                                1 +
                                images.length
                              ) %
                                images.length
                            )
                          }
                          style={{
                            position:
                              "absolute",
                            left:
                              "12px",
                            top:
                              "50%",
                            transform:
                              "translateY(-50%)",
                            width:
                              "44px",
                            height:
                              "44px",
                            border:
                              "none",
                            borderRadius:
                              "50%",
                            background:
                              "rgba(0,0,0,0.6)",
                            color:
                              "white",
                            fontSize:
                              "25px",
                            cursor:
                              "pointer",
                          }}
                        >
                          ‹
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setGalleryIndex(
                              (
                                galleryIndex +
                                1
                              ) %
                                images.length
                            )
                          }
                          style={{
                            position:
                              "absolute",
                            right:
                              "12px",
                            top:
                              "50%",
                            transform:
                              "translateY(-50%)",
                            width:
                              "44px",
                            height:
                              "44px",
                            border:
                              "none",
                            borderRadius:
                              "50%",
                            background:
                              "rgba(0,0,0,0.6)",
                            color:
                              "white",
                            fontSize:
                              "25px",
                            cursor:
                              "pointer",
                          }}
                        >
                          ›
                        </button>
                      </>
                    )}
                  </div>

                  {images.length >
                    1 && (
                    <div
                      style={{
                        display:
                          "flex",
                        gap:
                          "8px",
                        overflowX:
                          "auto",
                        marginTop:
                          "12px",
                        paddingBottom:
                          "5px",
                      }}
                    >
                      {images.map(
                        (
                          image,
                          index
                        ) => (
                          <button
                            key={
                              image.id
                            }
                            type="button"
                            onClick={() =>
                              setGalleryIndex(
                                index
                              )
                            }
                            style={{
                              flex:
                                "0 0 75px",
                              padding:
                                0,
                              border:
                                index ===
                                galleryIndex
                                  ? "2px solid white"
                                  : "2px solid transparent",
                              borderRadius:
                                "7px",
                              overflow:
                                "hidden",
                              cursor:
                                "pointer",
                              background:
                                "transparent",
                            }}
                          >
                            <img
                              src={getImageUrl(
                                image.storage_path
                              )}
                              alt={`Thumbnail ${
                                index +
                                1
                              }`}
                              style={{
                                width:
                                  "75px",
                                height:
                                  "55px",
                                objectFit:
                                  "cover",
                                display:
                                  "block",
                              }}
                            />
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

      {/* ========================================================
          FOOTER
      ======================================================== */}

      <footer
        style={{
          background:
            "#0B3B75",
          color: "white",
          padding:
            "28px 18px",
          textAlign:
            "center",
        }}
      >
        <strong>
          HOUSE CONNECT
        </strong>

        <div
          style={{
            marginTop:
              "6px",
            opacity:
              0.85,
            letterSpacing:
              "1px",
          }}
        >
          FIND • CONNECT • LIVE
        </div>

        <div
          style={{
            marginTop:
              "12px",
            opacity:
              0.7,
            fontSize:
              "12px",
          }}
        >
          Connecting tenants with
          legitimate property owners.
        </div>
      </footer>
    </main>
  );
}