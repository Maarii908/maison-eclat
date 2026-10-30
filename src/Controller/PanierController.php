<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

#[Route('/panier')]
final class PanierController extends AbstractController
{
    private function obtenirProduits(
        SessionInterface $session,
        HttpClientInterface $httpClient
    ): array {
        $panier = $session->get('panier', []);
        $produitsPanier = [];
        $total = 0;

        foreach ($panier as $documentId => $quantite) {
            try {
                $response = $httpClient->request(
                    'GET',
                    'http://host.docker.internal:1337/api/produits/' . $documentId . '?populate=*'
                );

                $produit = $response->toArray()['data'] ?? null;

                if ($produit) {
                    $prix = (float) ($produit['prix'] ?? 0);
                    $sousTotal = $prix * $quantite;

                    $produitsPanier[] = [
                        'documentId' => $documentId,
                        'titre' => $produit['titre'] ?? 'Produit beauté',
                        'image' => $produit['images'][0]['url'] ?? null,
                        'prix' => $prix,
                        'quantite' => $quantite,
                        'sousTotal' => $sousTotal,
                    ];

                    $total += $sousTotal;
                }
            } catch (\Throwable $e) {
                // Produit indisponible.
            }
        }

        return [
            'produits' => $produitsPanier,
            'total' => $total,
            'nombreArticles' => array_sum($panier),
        ];
    }

    #[Route('', name: 'panier_index', methods: ['GET'])]
    public function index(
        SessionInterface $session,
        HttpClientInterface $httpClient
    ): Response {
        $donnees = $this->obtenirProduits($session, $httpClient);

        return $this->render('panier/index.html.twig', [
            'produitsPanier' => $donnees['produits'],
            'total' => $donnees['total'],
        ]);
    }

    #[Route('/contenu', name: 'panier_contenu', methods: ['GET'])]
    public function contenu(
        SessionInterface $session,
        HttpClientInterface $httpClient
    ): JsonResponse {
        return $this->json(
            $this->obtenirProduits($session, $httpClient)
        );
    }

    #[Route('/ajouter/{documentId}', name: 'panier_ajouter', methods: ['POST'])]
    public function ajouter(
        string $documentId,
        SessionInterface $session,
        HttpClientInterface $httpClient
    ): JsonResponse {
        try {
            $response = $httpClient->request(
                'GET',
                'http://host.docker.internal:1337/api/produits/' . $documentId
            );

            $response->toArray();
        } catch (\Throwable $e) {
            return $this->json([
                'success' => false,
                'message' => 'Impossible d’ajouter ce produit.',
            ], 404);
        }

        $panier = $session->get('panier', []);
        $panier[$documentId] = ($panier[$documentId] ?? 0) + 1;
        $session->set('panier', $panier);

        return $this->json([
            'success' => true,
            'message' => 'Produit ajouté au panier.',
            'panier' => $this->obtenirProduits($session, $httpClient),
        ]);
    }

    #[Route('/diminuer/{documentId}', name: 'panier_diminuer', methods: ['POST'])]
    public function diminuer(
        string $documentId,
        SessionInterface $session,
        HttpClientInterface $httpClient
    ): JsonResponse {
        $panier = $session->get('panier', []);

        if (isset($panier[$documentId])) {
            $panier[$documentId]--;

            if ($panier[$documentId] <= 0) {
                unset($panier[$documentId]);
            }
        }

        $session->set('panier', $panier);

        return $this->json([
            'success' => true,
            'panier' => $this->obtenirProduits($session, $httpClient),
        ]);
    }

    #[Route('/supprimer/{documentId}', name: 'panier_supprimer', methods: ['POST'])]
    public function supprimer(
        string $documentId,
        SessionInterface $session,
        HttpClientInterface $httpClient
    ): JsonResponse {
        $panier = $session->get('panier', []);
        unset($panier[$documentId]);
        $session->set('panier', $panier);

        return $this->json([
            'success' => true,
            'panier' => $this->obtenirProduits($session, $httpClient),
        ]);
    }
}
