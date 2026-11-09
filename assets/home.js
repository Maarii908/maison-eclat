
document.addEventListener('DOMContentLoaded', () => {
    const openCartButton = document.getElementById('openCart');
    const closeCartButton = document.getElementById('closeCart');
    const cartPanel = document.getElementById('cartPanel');
    const cartOverlay = document.getElementById('cartOverlay');

    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    const validateCartButton = document.getElementById('validateCart');

    if (!cartPanel || !cartItems) {
        console.error('Le popup du panier est introuvable.');
        return;
    }

    // URLs fournies par Symfony dans home/index.html.twig
    const urls = {
        content: cartPanel.dataset.contentUrl,
        add: cartPanel.dataset.addUrl,
        decrease: cartPanel.dataset.decreaseUrl,
        remove: cartPanel.dataset.removeUrl
    };

    // Formater les prix en euros
    function formatPrice(value) {
        const price = Number(String(value ?? 0).replace(',', '.'));

        return `${(Number.isFinite(price) ? price : 0).toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} €`;
    }

    // Remplacer DOCUMENT_ID par l'identifiant du produit
    function buildUrl(urlTemplate, documentId) {
        if (!urlTemplate) {
            throw new Error('URL du panier introuvable.');
        }

        return urlTemplate.replace(
            'DOCUMENT_ID',
            encodeURIComponent(documentId)
        );
    }

    // Envoyer une requête à Symfony
    async function request(url, method = 'GET') {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const text = await response.text();
        let data = {};

        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            throw new Error('La réponse du serveur n’est pas au format JSON.');
        }

        if (!response.ok) {
            throw new Error(data.message || 'Une erreur est survenue.');
        }

        return data;
    }

    // Récupérer les données du panier
    function getCartData(response) {
        return response.panier ?? response;
    }

    // Afficher les produits dans le popup
    function renderCart(response) {
        const panier = getCartData(response);
        const produits = Array.isArray(panier.produits)
            ? panier.produits
            : [];

        cartItems.replaceChildren();

        const nombreArticles = Number(
            panier.nombreArticles ??
            produits.reduce((total, produit) => {
                return total + Number(produit.quantite || 0);
            }, 0)
        );

        cartCount.textContent = nombreArticles;

        cartTotal.textContent = formatPrice(panier.total);

        if (produits.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'cart-empty';
            emptyMessage.textContent = 'Votre panier est vide.';

            cartItems.appendChild(emptyMessage);
            return;
        }

        produits.forEach(produit => {
            const article = document.createElement('article');
            article.className = 'cart-item';

            // Image du produit
            if (produit.image) {
                const image = document.createElement('img');

                image.className = 'cart-item-image';

                image.src = produit.image.startsWith('http')
                    ? produit.image
                    : `http://localhost:1337${produit.image}`;

                image.alt = produit.titre || 'Produit beauté';
                image.loading = 'lazy';

                article.appendChild(image);
            }

            const information = document.createElement('div');
            information.className = 'cart-item-info';

            const titre = document.createElement('h3');
            titre.textContent = produit.titre || 'Produit beauté';

            const prix = document.createElement('p');
            prix.textContent = `Prix unitaire : ${formatPrice(produit.prix)}`;

            const sousTotal = document.createElement('p');
            sousTotal.textContent = `Sous-total : ${formatPrice(produit.sousTotal)}`;

            const actions = document.createElement('div');
            actions.className = 'cart-item-actions';

            // Bouton diminuer
            const decreaseButton = document.createElement('button');
            decreaseButton.type = 'button';
            decreaseButton.textContent = '−';
            decreaseButton.dataset.cartAction = 'decrease';
            decreaseButton.dataset.documentId = produit.documentId;
            decreaseButton.setAttribute('aria-label', 'Diminuer la quantité');

            // Quantité
            const quantity = document.createElement('span');
            quantity.textContent = produit.quantite;

            // Bouton augmenter
            const increaseButton = document.createElement('button');
            increaseButton.type = 'button';
            increaseButton.textContent = '+';
            increaseButton.dataset.cartAction = 'increase';
            increaseButton.dataset.documentId = produit.documentId;
            increaseButton.setAttribute('aria-label', 'Augmenter la quantité');

            // Bouton supprimer
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.textContent = 'Supprimer';
            removeButton.dataset.cartAction = 'remove';
            removeButton.dataset.documentId = produit.documentId;

            actions.append(
                decreaseButton,
                quantity,
                increaseButton,
                removeButton
            );

            information.append(titre, prix, sousTotal, actions);
            article.appendChild(information);

            cartItems.appendChild(article);
        });
    }

    // Charger le panier depuis Symfony
    async function loadCart() {
        try {
            const response = await request(urls.content);
            renderCart(response);
        } catch (error) {
            console.error('Erreur de chargement du panier :', error);
        }
    }

    // Ouvrir le popup
    function openCart() {
        cartPanel.classList.add('is-open');
        cartOverlay?.classList.add('is-visible');

        cartPanel.setAttribute('aria-hidden', 'false');
        document.body.classList.add('cart-open');
    }

    // Fermer le popup
    function closeCart() {
        cartPanel.classList.remove('is-open');
        cartOverlay?.classList.remove('is-visible');

        cartPanel.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('cart-open');
    }

    openCartButton?.addEventListener('click', () => {
        openCart();
        loadCart();
    });

    closeCartButton?.addEventListener('click', closeCart);
    cartOverlay?.addEventListener('click', closeCart);

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeCart();
        }
    });

    // Gérer les boutons d'ajout et les actions du panier
    document.addEventListener('click', async event => {

        // Ajouter un produit depuis la page d'accueil
        const addButton = event.target.closest('.add-cart-button');

        if (addButton) {
            const documentId = addButton.dataset.documentId;

            if (!documentId) {
                console.error('Identifiant du produit manquant.');
                return;
            }

            addButton.disabled = true;

            try {
                const url = buildUrl(urls.add, documentId);
                const response = await request(url, 'POST');

                renderCart(response);
                openCart();

            } catch (error) {
                console.error('Erreur lors de l’ajout :', error);
                alert(error.message);

            } finally {
                addButton.disabled = false;
            }

            return;
        }

        // Modifier ou supprimer un produit dans le popup
        const actionButton = event.target.closest('[data-cart-action]');

        if (!actionButton) {
            return;
        }

        const documentId = actionButton.dataset.documentId;
        const action = actionButton.dataset.cartAction;

        let urlTemplate;

        if (action === 'increase') {
            urlTemplate = urls.add;
        } else if (action === 'decrease') {
            urlTemplate = urls.decrease;
        } else if (action === 'remove') {
            urlTemplate = urls.remove;
        } else {
            return;
        }

        actionButton.disabled = true;

        try {
            const url = buildUrl(urlTemplate, documentId);
            const response = await request(url, 'POST');

            renderCart(response);

        } catch (error) {
            console.error('Erreur de modification du panier :', error);
            alert(error.message);

        } finally {
            actionButton.disabled = false;
        }
    });

    // Le bouton de validation ouvre la page panier complète
    validateCartButton?.addEventListener('click', () => {
        const pageUrl = cartPanel.dataset.pageUrl;

        if (pageUrl) {
            window.location.href = pageUrl;
        }
    });

    // Actualiser le compteur au chargement de la page
    loadCart();
});
